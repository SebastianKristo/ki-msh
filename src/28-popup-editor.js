/* KI MSH · «Tilpass Hjem» → Popups: alle Bubble-popups (Rom · Funksjoner · Egne) med full YAML-kontroll.
 * Kobles inn i HomeEditor (27-hjem-editor.js) via MSH.popupsPanel { render, act, input, after, drop }.
 * Kilder (se 04-strategy.js · MSH.mergePopups): Auto (generert), YAML (strategy: custom_popups – skrivebeskyttet her),
 * Egen (ki-store custom_popups), Overstyrt (ki-store popup_overrides[hash] = { replace: true, config }).
 *   Liste: ikon, navn, hash, kilde-chip, øye (popups.<key>.hidden), chevron → detalj. Egne kan dras for rekkefølge.
 *   «Ny popup» → mal Funksjon (A) / Rom (B, velg område) / Tom → YAML-editor (ikke lagret før «Ferdig»).
 *   YAML-editor: ha-code-editor (mode yaml) når HA har lastet den, ellers textarea med linjenumre. Navn og hash
 *   synkes med teksten. Validering (MSH.yaml + type/card_type/hash/unik) med linjenummer; «Ferdig» er av til alt er gyldig.
 *   Skjema-modus: navn, ikon, hash, bredde, bg_opacity, bg_blur, bakgrunn, ikonfarge, header-bakgrunn.
 *   Forhåndsvis åpner popupen via hash uten å lagre (midlertidig popup / setConfig på den levende), «Tilbake» gjenåpner arket.
 *   «Strømpris» → felles strømpris-kilde (power_price, 29-strompris-editor.js · MSH.powerPricePanel, visning u.pv = 'strom').
 *   ⋮ → «Eksporter alle som YAML» (custom_popups + popup_overrides, klart til å lime inn under strategy:).
 * Egne popups · import (fiks 15.5/15.8):
 *   «Importer» → lim inn eller last opp .yaml/.txt/.html (TextEdit/Cocoa-HTML → MSH.yaml.toText), delt ved hver
 *   «type: custom:bubble-card» på rotnivå (MSH.yaml.splitDocs). Forhåndsvisning med avkrysning. Popups lagres som
 *   { id, hash, name, icon, yaml, imported } i ki-store custom_popups – YAML-teksten uendret (kommentarer, styles: |+,
 *   [[[ ]]]-maler og Jinja beholdes). Rotnøkler som button_card_templates/decluttering_templates/paper_buttons_row
 *   → ki-store dashboard_globals { yaml } («Maler og globale innstillinger»-raden, egen YAML-editor, Importer/Eksporter).
 *   Egen popup med samme hash som en generert vinner: den genererte vises som «Erstattet av egen popup» med
 *   «Bruk autogenerert» (popups.<key>.prefer = 'auto'). «Ett kort per popup» gjelder ikke egne popups.
 *   Liste: ikon, navn, #hash, antall kort, «Mangler kort: x» (customElements.get), banner for manglende HACS-kort og
 *   for maler popupene bruker som ikke finnes («→ Importer maler»).
 *   Redigering: navn/ikon/hash-felt synkes mot toppnøklene i YAML-teksten (resten av teksten røres ikke).
 */
(function () {
  const M = window.MSH;
  if (!M || M.popupsPanel) return;
  const esc = M.esc, C = M.C;
  const ic = (n, s, st) => M.icon(n, s || 20, st || '');
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const PINK = C.accent;
  const COLS = ['var(--gray1000)', 'var(--green)', 'var(--blue)', 'var(--orange)', 'var(--yellow)', 'var(--pink)', 'var(--red)', 'var(--purple)', 'var(--light-blue)', 'var(--gray000)', 'var(--gray200)'];
  const GROUPS = [['alle', 'mdi:layers-outline', 'Alle'], ['rom', 'mdi:texture-box', 'Rom'], ['fn', 'mdi:apps', 'Funksjoner'], ['egne', 'mdi:star-outline', 'Egne']];
  const SRCL = { auto: 'Auto', yaml: 'YAML', custom: 'Egen' };
  const SRCLONG = { auto: 'generert', yaml: 'strategi-YAML', custom: 'Egen (ki-store)' };
  const CHIP = { Auto: ['var(--ki-text-2, #afafaf)', 'rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)))'], YAML: ['var(--ki-blue-text, ' + C.blue + ')', 'rgb(115 185 242 / 0.16)'], Egen: ['var(--ki-green-text, ' + C.green + ')', 'rgb(102 209 158 / 0.16)'], Overstyrt: ['var(--ki-orange-text, ' + C.orange + ')', 'rgb(242 181 115 / 0.16)'], Skjult: ['var(--ki-text-mid, #979797)', 'rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))'] };
  const chip = (l) => { const [c, b] = CHIP[l] || CHIP.Auto; return `<span class="ppchip" style="color:${c};background:${b}">${esc(l)}</span>`; };
  const Yp = (t) => M.yaml.parse(t), Yd = (v) => M.yaml.dump(v);
  const store = () => (M.store && M.store.get()) || {};
  const customList = () => { const l = store().custom_popups; return Array.isArray(l) ? l : []; };
  const storeOv = () => { const o = store().popup_overrides; return isObj(o) ? o : {}; };
  const yamlList = () => { const l = (M.strategyConfig || {}).custom_popups; return Array.isArray(l) ? l : []; };
  const yamlOv = () => { const o = (M.strategyConfig || {}).popup_overrides; return isObj(o) ? o : {}; };
  const isWrap = (c) => isObj(c) && typeof c.yaml === 'string' && !c.type; // importert/egen popup lagret som YAML-tekst
  const cfgOf = (c) => (M.customPopupConfig ? M.customPopupConfig(c).cfg : isWrap(c) ? null : c);
  const globalsRaw = () => store().dashboard_globals;
  const globalsText = () => { const g = globalsRaw(); return !isObj(g) ? '' : typeof g.yaml === 'string' ? g.yaml : Yd(g); };
  // Én kilde for malene (fiks 16.9): MSH.getGlobals() – det samme som strategien og mal-løseren bruker
  const globalsObj = () => (M.getGlobals ? M.getGlobals() : {});
  const newId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const HASH_RX = /^#[a-z0-9_-]+$/;

  /* ------------------------------------------------------------ kort, maler og HACS-avhengigheter */
  const GLOBAL_KEYS = ['button_card_templates', 'decluttering_templates', 'paper_buttons_row'];
  // HACS-pakke → elementnavn som må finnes (ett av dem holder)
  const HACS = [['button-card', ['button-card']], ['decluttering-card', ['decluttering-card']], ['paper-buttons-row', ['paper-buttons-row']], ['layout-card', ['layout-card', 'grid-layout']], ['my-cards', ['my-slider', 'my-slider-v2']], ['mini-graph-card', ['mini-graph-card']], ['expander-card', ['expander-card']], ['simple-tabs', ['simple-tabs']], ['bubble-card', ['bubble-card']], ['gap-card', ['gap-card']]];
  const defined = (t) => typeof customElements !== 'undefined' && !!customElements.get(t);
  M.missingHacs = () => HACS.filter(([, tags]) => !tags.some(defined)).map(([n]) => n);
  // Alle custom:-typer i en config (også nestet: stacks, custom_fields, card:, elements …)
  function customTypes(v, out, d) {
    out = out || new Set();
    if (d > 40 || v == null || typeof v !== 'object') return out;
    if (Array.isArray(v)) { v.forEach((x) => customTypes(x, out, (d || 0) + 1)); return out; }
    if (typeof v.type === 'string' && /^custom:/.test(v.type)) out.add(v.type.slice(7));
    Object.keys(v).forEach((k) => { if (v[k] && typeof v[k] === 'object') customTypes(v[k], out, (d || 0) + 1); });
    return out;
  }
  M.popupMissingCards = (cfg) => [...customTypes(cfg)].filter((t) => !defined(t));
  // Maler popupen bruker (button-card/decluttering-card «template:», streng eller liste) → Set med navn
  const templateRefs = (v) => { const r = M.templateRefs(v); return new Set([...r.bc, ...r.dc]); };
  // Maler som brukes av egne popups (også via arv: template: [universal_base]) men ikke finnes i MSH.getGlobals()
  const missingTemplates = (list) => M.missingTemplates((list || customList().map(cfgOf)).filter(Boolean), globalsObj());
  M.popupMissingTemplates = missingTemplates;
  const nCards = (c) => (c && Array.isArray(c.cards) ? c.cards.length : 0);
  const kortN = (n) => `${n} kort`;
  const userPops = (ed) => (ed._popCfg ? ed._popCfg() : (M.store && M.store.get('popups'))) || {};
  const chipOf = (e) => (e.source === 'auto' && e.override ? 'Overstyrt' : SRCL[e.source] || 'Auto');
  const slugH = (s) => M.slug(s).replace(/_/g, '-') || 'popup';
  let seq = 0;

  /* ------------------------------------------------------------ data */
  function entries(ed) {
    const R = M.popupReport;
    if (R && Array.isArray(R.entries)) return R;
    if (!ed.__ppLoading && ed.hass && M.generateDashboardView) {
      ed.__ppLoading = true;
      M.generateDashboardView(M.strategyConfig || {}, ed.hass).catch((e) => console.error('[ki-msh] popups', e)).finally(() => { ed.__ppLoading = false; ed._schedule(); });
    }
    return { entries: [], collisions: [], invalid: [], loading: true };
  }
  const entryOf = (ed, hash) => entries(ed).entries.find((e) => e.hash === hash) || null;
  // Alle hasher i bruk (unntatt «self»)
  function hashesInUse(ed, self) {
    const S = new Set();
    entries(ed).entries.forEach((e) => S.add(e.hash));
    yamlList().forEach((c) => c && c.hash && S.add(String(c.hash)));
    customList().forEach((c) => c && c.hash && S.add(String(c.hash)));
    if (self) S.delete(self);
    return S;
  }
  const uniqueHash = (ed, base, self) => { const used = hashesInUse(ed, self); let h = base, n = 2; while (used.has(h)) h = base + '-' + n++; return h; };

  /* ------------------------------------------------------------ validering */
  function lineOf(text, key) {
    const L = String(text).split('\n'), rx = new RegExp(`^(['"]?)${key}\\1\\s*:`);
    const i = L.findIndex((l) => rx.test(l));
    return i >= 0 ? i + 1 : null;
  }
  function validate(ed, d) {
    let obj;
    try { obj = Yp(d.text); } catch (e) { return { err: { msg: e.reason || e.message, line: e.line } }; }
    const bad = (msg, key) => ({ obj, err: { msg, line: key ? lineOf(d.text, key) : null } });
    if (d.src === 'globals') {
      if (obj == null) return { obj: {}, err: null };
      if (!isObj(obj)) return bad('Må være nøkler på rotnivå (button_card_templates:, decluttering_templates: …)', null);
      for (const k of ['views', 'strategy', 'title']) if (k in obj) return bad(`«${k}» hører ikke hjemme her – bare dashbord-globale nøkler som maler`, k);
      for (const k of GLOBAL_KEYS) if (k in obj && obj[k] != null && !isObj(obj[k])) return bad(`${k} må være nøkler (navn: …)`, k);
      return { obj, err: null };
    }
    if (!isObj(obj)) return bad('Popupen må være et objekt (nøkkel: verdi)', null);
    if (obj.type !== 'custom:bubble-card') return bad('type må være custom:bubble-card', 'type');
    if (obj.card_type !== 'pop-up') return bad('card_type må være pop-up', 'card_type');
    if (typeof obj.hash !== 'string' || !/^#[^\s#]+$/.test(obj.hash)) return bad("hash må starte med # og være uten mellomrom (f.eks. '#garasje')", 'hash');
    if ((d.src === 'auto' || d.src === 'over') && obj.hash !== d.hash0) return bad(`Hash kan ikke endres for en generert popup (${d.hash0})`, 'hash');
    if (d.src !== 'auto' && d.src !== 'over' && obj.hash !== d.hash0 && !HASH_RX.test(obj.hash)) return bad('hash kan bare ha små bokstaver a–z, tall, - og _ etter #', 'hash');
    if (d.src !== 'auto' && d.src !== 'over' && hashesInUse(ed, d.hash0).has(obj.hash)) return bad(`${obj.hash} er allerede i bruk av en annen popup`, 'hash');
    if (obj.cards !== undefined && !Array.isArray(obj.cards)) return bad('cards må være en liste', 'cards');
    return { obj, err: null };
  }

  /* ------------------------------------------------------------ utkast */
  function draftFor(ed, e) {
    const d = { id: 'd' + ++seq, hash0: e.hash, mode: 'yaml', dirty: false, confirmDel: false };
    const so = storeOv()[e.hash];
    if (yamlOv()[e.hash] !== undefined && yamlOv()[e.hash] !== null) { d.src = 'yamlov'; d.ro = true; d.text = Yd(e.config || e.base); d.note = 'Overstyrt i dashbordets rå konfigurasjon (strategy: popup_overrides) – rediger den der.'; }
    else if (e.source === 'yaml') { d.src = 'yaml'; d.ro = true; d.text = Yd(e.base); d.note = 'Definert i dashbordets rå konfigurasjon (strategy: custom_popups).'; }
    else if (e.source === 'custom') { const raw = customList()[e.index]; d.src = 'custom'; d.index = e.index; d.wrap = isWrap(raw); d.text = d.wrap ? raw.yaml : Yd(raw || e.base); }
    else if (so && isObj(so) && so.replace && isObj(so.config)) { d.src = 'over'; d.text = Yd(so.config); }
    else { d.src = 'auto'; d.mode = 'form'; d.text = Yd(e.config || e.gen || e.base); }
    d.v = validate(ed, d);
    return d;
  }
  function newDraft(ed, cfg, note, text) {
    const d = { id: 'd' + ++seq, src: 'new', hash0: null, mode: 'yaml', dirty: true, text: text != null ? text : Yd(cfg), hashAuto: true, note, wrap: text != null };
    d.v = validate(ed, d);
    return d;
  }
  // Egen popup som ikke kan parses (ugyldig YAML) → åpne teksten så feilen kan rettes
  function draftRaw(ed, index) {
    const raw = customList()[index];
    const d = { id: 'd' + ++seq, src: 'custom', index, wrap: isWrap(raw), hash0: isObj(raw) && raw.hash ? String(raw.hash) : null, mode: 'yaml', dirty: false, confirmDel: false };
    d.text = d.wrap ? raw.yaml : Yd(raw);
    d.v = validate(ed, d);
    return d;
  }
  // Skriv en toppnivånøkkel i teksten uten å røre resten (bevarer kommentarer/formatering)
  function setTopKey(text, key, value) {
    const line = Yd({ [key]: value }).replace(/\n$/, '');
    const rx = new RegExp(`^(['"]?)${key}\\1\\s*:.*$`, 'm');
    let out;
    if (rx.test(text)) out = text.replace(rx, line.replace(/\$/g, '$$$$'));
    else {
      const L = text.split('\n'), i = L.findIndex((l) => /^card_type\s*:/.test(l));
      L.splice(i >= 0 ? i + 1 : 0, 0, line);
      out = L.join('\n');
    }
    // sikkerhetsnett: verdien over flere linjer (blokk) e.l. → skriv hele objektet på nytt
    try { const o = Yp(out); if (!isObj(o) || JSON.stringify(o[key]) !== JSON.stringify(value)) throw 0; } catch (e) {
      try { const o = Yp(text); if (isObj(o)) { o[key] = value; return Yd(o); } } catch (x) { /* ugyldig tekst: behold linjeerstatningen */ }
    }
    return out;
  }

  /* ------------------------------------------------------------ lagring */
  // Egne popups, overstyringer og maler lagres straks (eksplisitte handlinger: import, Ferdig i underarket, slett) –
  // også mens «Tilpass Hjem»-utkastet er åpent, så de ikke rulles tilbake om arket lukkes uten Ferdig.
  const NOW = new Set(['dashboard_globals', 'custom_popups', 'popup_overrides']);
  const save = (ed, key, val) => { ed._saving = true; try { if (ed.hass) M.store.load(ed.hass); return M.store.set(key, val, { immediate: true, now: NOW.has(key) }); } finally { ed._saving = false; } };
  function commit(ed) {
    const u = ed.u, d = u.pd;
    if (!d || d.ro) return back(ed);
    if (d.src === 'auto' && !d.dirty) return back(ed);
    const v = d.v = validate(ed, d);
    if (v.err) { M.haptic('warning'); return ed.render(); }
    const obj = v.obj;
    const wrapOf = (old) => ({ ...(isWrap(old) ? old : {}), id: (isWrap(old) && old.id) || newId(), hash: obj.hash, name: obj.name || '', icon: obj.icon || '', yaml: d.text.endsWith('\n') ? d.text : d.text + '\n' });
    if (d.src === 'globals') {
      const t = String(d.text || '');
      save(ed, 'dashboard_globals', t.trim() && isObj(obj) && Object.keys(obj).length ? { yaml: t.endsWith('\n') ? t : t + '\n' } : undefined);
      M.toast('Maler lagret · dashbordet oppdateres');
    } else if (d.src === 'new') {
      save(ed, 'custom_popups', [...customList(), d.wrap ? wrapOf(null) : obj]);
      M.toast(`Popup lagret · åpnes med ${obj.hash}`);
    } else if (d.src === 'custom') {
      const L = customList().slice(), old = L[d.index];
      const val = d.wrap ? wrapOf(old) : obj;
      if (d.index >= 0 && d.index < L.length) L[d.index] = val; else L.push(val);
      save(ed, 'custom_popups', L);
      M.toast('Popup lagret');
    } else if (d.src === 'auto' || d.src === 'over') {
      save(ed, 'popup_overrides', { ...storeOv(), [d.hash0]: { replace: true, config: obj } });
      M.toast('Popup overstyrt');
    }
    M.haptic('success');
    back(ed);
  }
  function back(ed) { ed.u.pv = null; ed.u.pd = null; ed.u.ppMenu = false; ed.render(); }

  /* ------------------------------------------------------------ forhåndsvisning */
  let PV = null;
  function endPreview() {
    const p = PV; if (!p) return;
    PV = null;
    window.removeEventListener('hashchange', p.onHash);
    window.removeEventListener('location-changed', p.onHash);
    if (p.pill) p.pill.remove();
    try { p.restore && p.restore(); } catch (e) { /* */ }
    if (location.hash === p.hash) {
      history.replaceState(history.state, '', location.href.split('#')[0]);
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
      window.dispatchEvent(new Event('hashchange'));
    }
    setTimeout(() => {
      const ed = M.openHomeEditor && M.openHomeEditor({ focus: 'pop' });
      if (ed && ed.u) { Object.assign(ed.u, p.state); ed.render(); }
    }, 60);
  }
  function preview(ed) {
    const d = ed.u.pd;
    const v = d && (d.v = validate(ed, d));
    if (!v || v.err) { M.haptic('warning'); M.toast('Rett feilen i YAML først'); return; }
    const cfg = v.obj, hass = ed.hass;
    const live = M.liveBubbles ? M.liveBubbles() : [];
    const ex = live.find((x) => x.cfg.hash === cfg.hash);
    let restore = null;
    if (ex) {
      const old = ex.cfg;
      if (JSON.stringify(old) !== JSON.stringify(cfg)) { try { ex.el.setConfig(cfg); restore = () => ex.el.setConfig(old); } catch (e) { M.toast('Bubble Card avviste configen: ' + e.message); return; } }
    } else {
      let el;
      try { el = M.createLivePopup(cfg, hass, live[live.length - 1]); } catch (e) { M.toast('Bubble Card avviste configen: ' + e.message); return; }
      el.__kiTemp = true;
      const parent = live.length ? live[live.length - 1].wrap.parentNode : document.body;
      parent.appendChild(el);
      restore = () => el.remove();
    }
    const state = { pv: ed.u.pv, pd: { ...d }, popG: ed.u.popG, sec: 'pop' };
    PV = { hash: cfg.hash, restore, state };
    ed.close();
    setTimeout(() => {
      if (!PV) return;
      location.hash = cfg.hash;
      const pill = document.createElement('button');
      pill.textContent = 'Tilbake til Tilpass Hjem';
      const R = M.dashRect();
      Object.assign(pill.style, { position: 'fixed', left: R.left + R.width / 2 + 'px', transform: 'translateX(-50%)', bottom: 'calc(var(--ki-nav-h, 68px) + var(--ki-nav-bottom, 8px) + env(safe-area-inset-bottom, 0px) + 16px)', zIndex: '20', height: '44px', padding: '0 20px', borderRadius: '22px', border: '0', background: PINK, color: 'var(--ki-on-accent, #2f2f2f)', font: `600 14px ${M.FONT}`, boxShadow: '0 8px 24px rgb(0 0 0/max(var(--ki-ka-min,0),calc(0.4*var(--ki-ka-k,1))))', cursor: 'pointer', pointerEvents: 'auto' });
      pill.addEventListener('click', (e) => { e.stopPropagation(); M.haptic('light'); endPreview(); });
      ['pointerdown', 'mousedown', 'touchstart'].forEach((t) => pill.addEventListener(t, (e) => e.stopPropagation()));
      M.overlayRoot().appendChild(pill);
      PV.pill = pill;
      // lukkes popupen (Bubbles lukk/sveip) → tilbake til arket
      setTimeout(() => {
        if (!PV) return;
        PV.onHash = () => { if (PV && location.hash !== PV.hash) endPreview(); };
        window.addEventListener('hashchange', PV.onHash);
        window.addEventListener('location-changed', PV.onHash);
      }, 400);
    }, 280);
  }

  /* ------------------------------------------------------------ utklippstavle / nedlasting */
  async function copy(text, what) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      try { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove(); } catch (x) { /* */ }
    }
    M.toast(ok ? `${what || 'YAML'} kopiert` : 'Kunne ikke kopiere – merk teksten og kopier selv');
    if (ok) M.haptic('success');
  }
  function download(text, name) {
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/yaml' }));
      a.download = name; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } catch (e) { M.toast('Nedlasting feilet'); }
  }
  const exportText = () => '# KI MSH · egne popups – lim inn under «strategy:» i dashbordets rå konfigurasjon\n' + Yd({ custom_popups: customList().map(cfgOf).filter(Boolean), popup_overrides: storeOv() });
  // Egne popups som én fil (samme format som importen leser: popupene etter hverandre, YAML-teksten uendret)
  const exportCustomText = () => customList().map((c) => (isWrap(c) ? c.yaml : Yd(c)).replace(/\n*$/, '\n')).join('\n');

  /* ------------------------------------------------------------ stil */
  const CSS = `
    .pphd{display:flex;align-items:center;gap:8px}
    .pphd .t{flex:1;min-width:0;font-size:17px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pphd .done[disabled]{opacity:.35;pointer-events:none}
    .ppbar{display:flex;align-items:center;gap:6px}
    .ppbar .pgs{flex:1;min-width:0}
    .ppnew{height:40px;padding:0 14px 0 10px;border-radius:20px;display:flex;align-items:center;gap:6px;font-size:14px;font-weight:600;background:${PINK};color:var(--ki-on-accent, #2f2f2f);flex:none}
    .ppmn{position:relative;flex:none}
    .ppmenu{position:absolute;right:0;top:44px;z-index:5;min-width:230px;padding:6px;border-radius:18px;background:var(--ki-surface-2, var(--gray300,#404040));box-shadow:0 12px 30px rgb(0 0 0/max(var(--ki-ka-min,0),calc(.45*var(--ki-ka-k,1))));display:flex;flex-direction:column}
    .ppmenu button{display:flex;align-items:center;gap:10px;height:44px;padding:0 12px;border-radius:12px;font-size:14px;text-align:left}
    .ppmenu button:hover{background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .ppgh{font-size:12px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--ki-text-3, #7f7f7f);padding:6px 6px 0}
    .pr.ppr{gap:8px;padding:8px 6px 8px 10px}
    .ppr .ppm{display:flex;align-items:center;gap:12px;flex:1;min-width:0;text-align:left}
    .ppr .pph{width:22px;height:40px;flex:none;display:grid;place-items:center;color:var(--ki-text-3, #7f7f7f);cursor:grab;touch-action:none}
    .ppchip{height:22px;padding:0 8px;border-radius:11px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;flex:none;white-space:nowrap}
    .ppr .sq.no{opacity:.3;pointer-events:none}
    .ppr.hov-t{box-shadow:inset 0 3px 0 ${PINK}} .ppr.hov-b{box-shadow:inset 0 -3px 0 ${PINK}}
    .ppwarn{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:18px;background:rgb(242 181 115 / 0.14);color:var(--ki-orange-text, ${C.orange});font-size:13px;line-height:1.4}
    .ppwarn.err{background:rgb(242 128 115 / 0.14);color:var(--ki-red-text, ${C.red})}
    .ppwarn b{font-weight:600}
    .ppnote{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:18px;background:var(--ki-surface, var(--gray200,#3a3a3a));color:var(--ki-text-1, #c7c7c7);font-size:13px;line-height:1.4}
    .ppmeta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:0 4px;font-size:12px;color:var(--ki-text-mid, #979797)}
    .ppcode{min-height:200px}
    .ppta{display:flex;height:380px;border-radius:18px;background:var(--ki-bg, var(--gray000,#232323));overflow:hidden;box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .ppta.ro{opacity:.85}
    .ppgut{flex:none;min-width:30px;padding:12px 8px 12px 10px;text-align:right;color:var(--ki-text-lo, #696969);font:12px/18px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow:hidden;white-space:pre;background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.03*var(--ki-wa-k,1)),var(--ki-wa-max,1)));-webkit-user-select:none;user-select:none}
    .ppgut .bad{color:var(--ki-red-text, ${C.red});font-weight:700}
    .ppta textarea{flex:1;min-width:0;height:100%;box-sizing:border-box;resize:none;border:0;outline:0;margin:0;background:transparent;color:var(--ki-text, #fafafa);font:12px/18px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:12px 12px 12px 8px;white-space:pre;overflow:auto;tab-size:2;-webkit-user-select:text;user-select:text}
    .ppcode ha-code-editor{display:block;border-radius:18px;overflow:hidden;max-height:420px;overflow-y:auto}
    .ppacts{display:flex;flex-wrap:wrap;gap:8px}
    .ppb{height:40px;padding:0 14px 0 12px;border-radius:20px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;background:var(--ki-surface, var(--gray200,#3a3a3a));color:var(--ki-text, #fafafa)}
    .ppb.red{background:rgb(242 128 115 / 0.18);color:var(--ki-red-text, ${C.red})}
    .ppb.redf{background:${C.red};color:var(--ki-on-accent, #232323)}
    .ppf{display:flex;flex-direction:column;gap:12px;padding:14px;border-radius:24px;background:var(--ki-surface, var(--gray200,#3a3a3a))}
    .ppf .in{background:var(--ki-bg, var(--gray000,#232323))}
    .ppf .rw{display:flex;gap:8px;align-items:center}
    .ppf .rv{min-width:44px;text-align:right;font-size:13px;color:var(--ki-text-1, #c7c7c7);font-variant-numeric:tabular-nums}
    .ppsw{display:flex;flex-wrap:wrap;gap:6px}
    .ppsw button{width:28px;height:28px;border-radius:14px;box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(.15*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .ppsw button.on{box-shadow:0 0 0 2px var(--ki-text, #fafafa)}
    .ppt{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .ppt button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:96px;padding:10px;border-radius:22px;background:var(--ki-surface, var(--gray200,#3a3a3a));font-size:13px;font-weight:500;text-align:center}
    .ppt button i{font-style:normal;font-size:11px;color:var(--ki-text-mid, #979797);font-weight:400}
    .ppt button.on{background:var(--ki-ctrl, #545454);box-shadow:inset 0 0 0 2px ${PINK}}
    .ppbar .pg{height:36px;padding:0 12px 0 10px;font-size:13px}
    .ppmiss{color:var(--ki-red-text, ${C.red});font-style:normal}
    .ppwarn .ppb{height:32px;margin-top:6px}
    .ppimp{display:flex;flex-direction:column;gap:8px}
    .ppimp textarea{width:100%;box-sizing:border-box;height:160px;resize:vertical;border:0;outline:0;border-radius:18px;padding:12px;background:var(--ki-bg, var(--gray000,#232323));color:var(--ki-text, #fafafa);font:12px/18px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre;box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .ppfile{position:relative;overflow:hidden}
    .ppfile input{position:absolute;inset:0;opacity:0;cursor:pointer}
    .ppchk{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:20px;background:var(--ki-surface, var(--gray200,#3a3a3a));text-align:left;width:100%;box-sizing:border-box}
    .ppchk .bx{width:24px;height:24px;border-radius:8px;flex:none;display:grid;place-items:center;box-shadow:inset 0 0 0 2px var(--ki-text-3, #7f7f7f)}
    .ppchk.on .bx{background:${PINK};box-shadow:none;color:var(--ki-on-accent, #2f2f2f)}
    .ppchk.bad{opacity:.75}
    .ppchk .pn{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .ppchk .pn b{font-weight:500;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ppchk .pn i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #979797)}
    .ppicf{display:flex;gap:8px;align-items:center}
    .ppconv{max-height:320px;overflow:auto;border-radius:16px;background:var(--ki-bg, var(--gray000,#232323));padding:8px 0;font:12px/1.5 ui-monospace,Menlo,monospace;color:var(--ki-text-1, var(--gray900,#c7c7c7));-webkit-user-select:text;user-select:text}
    .ppconv>div{display:flex;gap:10px;padding:0 10px;white-space:pre}
    .ppconv>div.bad{background:rgb(242 128 115 / 0.18)}
    .ppconv i{font-style:normal;color:var(--ki-text-3, var(--gray600,#7f7f7f));min-width:36px;text-align:right;flex:none}
    .ppicf ha-icon-picker{flex:1}
  `;

  /* ------------------------------------------------------------ render */
  function renderList(ed) {
    const u = ed.u, R = entries(ed), P = userPops(ed);
    const g = u.popG === 'person' ? 'fn' : u.popG || 'alle';
    const bar = `<div class="ppbar">
        <div class="pgs">${GROUPS.map(([id, icn, l]) => `<button class="pg ${g === id ? 'on' : ''}" data-a="popg" data-v="${id}" data-h="selection">${ic(icn, 18)}${l}</button>`).join('')}</div>
      </div>
      <div class="ppbar"><button class="ppnew press" data-a="ppnew" data-key="ppnew">${ic('mdi:plus', 18)}Ny popup</button><button class="b40 press" style="display:flex;align-items:center;gap:6px;flex:none" data-a="ppimport" data-key="ppimport">${ic('mdi:import', 18)}Importer</button>${M.powerPricePanel ? `<button class="b40 press" style="display:flex;align-items:center;gap:6px;flex:none" data-a="ppstrom" data-key="ppstrom">${ic('mdi:lightning-bolt', 18)}Strømpris</button>` : ''}<span style="flex:1"></span>
        <div class="ppmn"><button class="sq" style="width:40px;height:40px;border-radius:20px;background:var(--ki-surface, var(--gray200,#3a3a3a))" data-a="ppmenu" title="Mer">${ic('mdi:dots-vertical', 20)}</button>
        ${u.ppMenu ? `<div class="ppmenu"><button data-a="ppexport">${ic('mdi:export-variant', 20)}Eksporter alle som YAML</button>${customList().length ? `<button data-a="ppexportown">${ic('mdi:file-export-outline', 20)}Eksporter egne popups (fil)</button>` : ''}<button data-a="ppglobals">${ic('mdi:file-code-outline', 20)}Maler og globale innstillinger</button></div>` : ''}</div>
      </div>`;
    const own = customList(), ownCfg = own.map(cfgOf);
    const hacs = own.length || globalsText() ? M.missingHacs() : [];
    const mt = own.length ? missingTemplates(ownCfg) : [];
    const warns = [
      impNote(u),
      hacs.length ? `<div class="ppwarn" data-key="pphacs">${ic('mdi:puzzle-remove-outline', 20)}<span><b>Mangler: ${esc(hacs.join(', '))} (HACS)</b><br>Egne/importerte popups som bruker disse kortene viser HAs feilkort til de er installert.</span></div>` : '',
      mt.length ? `<div class="ppwarn" data-key="pptpl">${ic('mdi:file-alert-outline', 20)}<span>Popupene bruker maler som mangler: <b>${esc(mt.slice(0, 8).join(', '))}${mt.length > 8 ? ` … (+${mt.length - 8})` : ''}</b><br><button class="ppb" data-a="ppimport" data-v="globals">${ic('mdi:import', 18)}Importer maler</button></span></div>` : '',
      ...(R.collisions || []).filter((c) => c.kind !== 'replace').map((c) => `<div class="ppwarn">${ic('mdi:alert-outline', 20)}<span><b>${esc(c.hash)}</b> er definert flere steder – ${esc(SRCLONG[c.winner])} brukes, ${c.losers.map((l) => esc(SRCLONG[l])).join(' og ')} ignoreres. Gi popupen en annen hash.</span></div>`),
      ...(R.invalid || []).filter((x) => x.source !== 'custom').map((x) => `<div class="ppwarn err">${ic('mdi:alert-circle-outline', 20)}<span>${esc(SRCLONG[x.source] || x.source)} nr. ${x.index + 1} ${esc(x.reason)} og er hoppet over.</span></div>`),
    ].join('');
    const E = R.entries.filter((e) => g === 'alle' || e.group === g);
    const nCustom = customList().length;
    const row = (e) => {
      const hidUser = !!(P[e.key] && P[e.key].hidden), lockHide = e.hidden && e.hiddenBy === 'yaml';
      const drag = e.source === 'custom' ? `data-drag="pop" data-id="${e.index}" data-drop="pop:${e.index}"` : '';
      const col = M.color(e.color || 'var(--gray1000)', C.gray1000);
      return `<div class="pr ppr ${e.hidden ? 'hid' : ''}" data-key="ppr-${esc(e.hash)}" ${drag}>
        ${e.source === 'custom' ? `<span class="pph" title="Dra for rekkefølge">${ic('mdi:drag', 20)}</span>` : ''}
        <button class="ppm" data-a="ppopen" data-v="${esc(e.hash)}"><span class="pi" style="background:${col}">${ic(e.icon, 22)}</span><span class="pn"><b>${esc(e.name)}</b><i>${esc(e.hash)}${e.source === 'custom' ? ' · ' + kortN(nCards(e.base)) : ''}${e.hidden ? ' · skjult' : ''}${e.replacesAuto ? ' · erstatter generert' : ''}${miss(e)}</i></span></button>
        ${chip(chipOf(e))}
        <button class="sq ${lockHide ? 'no' : ''}" data-a="ppeye" data-v="${esc(e.hash)}" data-h="selection" title="${e.hidden ? 'Skjult' : 'Vises'}">${ic(e.hidden || hidUser ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 18, `color:${e.hidden ? 'var(--ki-text-lo, #696969)' : 'var(--ki-text, #fafafa)'}`)}</button>
        <button class="sq" data-a="ppopen" data-v="${esc(e.hash)}" title="Åpne">${ic('mdi:chevron-right', 20)}</button>
      </div>`;
    };
    // «Mangler kort: x» for egne popups (kort som ikke er installert)
    function miss(e) {
      if (e.source !== 'custom') return '';
      const m = M.popupMissingCards(e.base);
      return m.length ? `<br><span class="ppmiss">Mangler kort: ${esc(m.slice(0, 4).join(', '))}${m.length > 4 ? ' …' : ''}</span>` : '';
    }
    // Generert popup som er erstattet av en egen (samme hash)
    const repRow = (x) => `<div class="pr ppr hid" data-key="pprep-${esc(x.hash)}">
        <span class="ppm"><span class="pi" style="background:var(--ki-ctrl, var(--gray400,#545454))">${ic(x.icon, 22)}</span><span class="pn"><b>${esc(x.name)}</b><i>${esc(x.hash)} · Erstattet av egen popup</i></span></span>
        <button class="ppb" data-a="ppprefer" data-v="${esc(x.hash)}" data-p="auto" data-h="selection">Bruk autogenerert</button>
      </div>`;
    // Egen popup som er slått av fordi brukeren valgte den genererte
    const inaRow = (x) => `<div class="pr ppr hid" data-key="ppina-${esc(x.hash)}">
        <button class="ppm" data-a="ppopenraw" data-v="${x.index}"><span class="pi" style="background:var(--ki-ctrl, var(--gray400,#545454))">${ic(x.icon, 22)}</span><span class="pn"><b>${esc(x.name)}</b><i>${esc(x.hash)} · ${x.by ? 'Erstattet av ' + esc(x.by) : 'av – autogenerert brukes'}</i></span></button>
        <button class="ppb" data-a="ppprefer" data-v="${esc(x.hash)}" data-p="custom" data-h="selection">Bruk egen</button>
      </div>`;
    // Egen popup med ugyldig YAML (hoppes over i dashbordet) – kan åpnes og rettes
    const badRow = (x) => { const raw = customList()[x.index] || {}; return `<div class="pr ppr" data-key="ppbad-${x.index}">
        <button class="ppm" data-a="ppopenraw" data-v="${x.index}"><span class="pi" style="background:rgb(242 128 115 / 0.3)">${ic('mdi:alert-circle-outline', 22)}</span><span class="pn"><b>${esc(raw.name || x.hash || 'Egen popup ' + (x.index + 1))}</b><i class="ppmiss">${esc(x.reason)}</i></span></button>
        <button class="sq" data-a="ppopenraw" data-v="${x.index}" title="Rett">${ic('mdi:chevron-right', 20)}</button></div>`; };
    const G = globalsObj(), gn = (k) => Object.keys(isObj(G[k]) ? G[k] : {}).length;
    const gSum = globalsText() ? [gn('button_card_templates') && `${gn('button_card_templates')} button-card`, gn('decluttering_templates') && `${gn('decluttering_templates')} decluttering`, isObj(G.paper_buttons_row) && 'paper-buttons-row', ...Object.keys(G).filter((k) => !GLOBAL_KEYS.includes(k))].filter(Boolean).join(' · ') || 'tom' : 'Ikke importert';
    const gRow = `<div class="pr ppr" data-key="ppglob"><button class="ppm" data-a="ppglobals"><span class="pi" style="background:var(--ki-surface-2, var(--gray300,#404040))">${ic('mdi:file-code-outline', 22)}</span><span class="pn"><b>Maler og globale innstillinger</b><i>${esc(gSum)}</i></span></button><button class="sq" data-a="ppglobals" title="Åpne">${ic('mdi:chevron-right', 20)}</button></div>`;
    const extra = (id) => [
      ...(R.replaced || []).filter((x) => x.group === id).map(repRow),
      ...(id === 'egne' ? [...(R.inactive || []).map(inaRow), ...(R.invalid || []).filter((x) => x.source === 'custom').map(badRow)] : []),
    ].join('');
    let rows = '';
    if (R.loading) rows = '<div class="hint">Henter popups …</div>';
    else if (g === 'alle') {
      [['rom', 'Rom'], ['fn', 'Funksjoner'], ['egne', 'Egne']].forEach(([id, l]) => {
        const L = E.filter((e) => e.group === id), X = extra(id);
        if (L.length || X || id === 'egne') rows += `<div class="ppgh" data-key="ppgh-${id}">${l}</div>${id === 'egne' ? gRow : ''}${L.map(row).join('')}${X}${!L.length && !X && id === 'egne' ? '<div class="hint" data-key="ppnone">Ingen egne popups ennå – trykk «Ny popup» eller «Importer».</div>' : ''}`;
      });
    } else rows = (g === 'egne' ? gRow : '') + (E.map(row).join('') + extra(g) || `<div class="hint" data-key="ppnone">${g === 'egne' ? 'Ingen egne popups ennå – trykk «Ny popup» eller «Importer».' : 'Ingen popups her.'}</div>`);
    return `<div style="display:flex;flex-direction:column;gap:12px" data-key="pops"><style>${CSS}</style>
      ${bar}${warns}
      <div class="pl">${rows}</div>${gapRow(ed, null)}${g === 'alle' || g === 'rom' ? roomDefaults() : ''}
      ${(g === 'alle' || g === 'fn') && M.doorbellModeHTML && M.ringFind && M.ringFind(ed.hass) ? M.doorbellModeHTML('ppring') : ''}
      ${(g === 'alle' || g === 'fn') && M.vaerStilHTML ? M.vaerStilHTML('ppvaer') : ''}
      <span class="hint">Trykk en popup for å redigere navn, ikon og farge – eller hele YAML-en. Egne popups kan ha alle Bubble Card-valg og vilkårlige kort${nCustom > 1 ? '; dra i ⠿ for rekkefølge' : ''}. Endringer tas i bruk straks.</span>
    </div>`;
  }

  /* Fiks 26.18 · mellomrom fra Bubble-headeren til første kort. key = null → felles (ki-store popup_header_gap, standard −10);
   * key = popupens nøkkel → overstyring for én popup (ki-store popups.<key>.header_gap). Strategien bruker det (MSH.applyHeaderGap). */
  function gapRow(ed, key) {
    const S = store(), glob = M.headerGapOf ? M.headerGapOf(S.popup_header_gap, (M.strategyConfig || {}).popup_header_gap) : -10;
    const own = key ? (userPops(ed)[key] || {}).header_gap : S.popup_header_gap;
    const set = own !== undefined && own !== null && own !== '';
    const val = set ? Number(own) : glob;
    const lbl = key ? 'Mellomrom under headeren (denne popupen)' : 'Alle popups · mellomrom under headeren';
    const sub = key ? (set ? 'Egen verdi' : `Felles: ${glob} px`) : 'Fra Bubble-headeren til første kort. Standard −10 px; kan overstyres per popup.';
    return `<div class="${key ? 'fld' : 'ppf'}" data-key="ppgap-${esc(key || '_')}"><span style="display:flex;flex-direction:column;gap:2px"><b style="font-size:14px;font-weight:500">${lbl}</b><span class="hint" style="padding:0">${esc(sub)}</span></span>
      <div class="rw"><input type="range" min="-40" max="40" step="1" data-in="ppgap" data-k="${esc(key || '')}" value="${val}" style="flex:1"><span class="rv">${val} px</span>${set && (key || val !== -10) ? `<button class="std" data-a="ppgapreset" data-k="${esc(key || '')}">Standard</button>` : ''}</div></div>`;
  }
  function gapSave(ed, key, v) {
    if (!key) { save(ed, 'popup_header_gap', v === undefined || v === -10 ? undefined : v); return; }
    if (ed._popSet) { ed._popSet(key, { header_gap: v }); return; }
    const cur = { ...(userPops(ed)[key] || {}), header_gap: v };
    if (v === undefined) delete cur.header_gap;
    save(ed, 'popups.' + key, Object.keys(cur).length ? cur : undefined);
  }

  // Rom-popups · «Åpen ved start» (Fiks 7): global standard i ki-store room_defaults.open_on_start [ids].
  // Ikke satt = bare Lys (når rommet har lys). Rommets egen «Tilpass rom» → Seksjoner overstyrer per seksjon.
  function roomDefaults() {
    const F = M.ROOM_FOLD || [];
    if (!F.length) return '';
    const rd = store().room_defaults, l = rd && Array.isArray(rd.open_on_start) ? rd.open_on_start : null;
    const on = (k) => (l ? l.includes(k) : k === 'lys');
    return `<div class="ppf" data-key="pprd"><span style="display:flex;flex-direction:column;gap:2px"><b style="font-size:14px;font-weight:500">Rom-popups · åpen ved start</b><span class="hint">Seksjonene som er utvidet hver gang en rom-popup åpnes. Rommets egen «Tilpass rom» → Seksjoner overstyrer.</span></span>
      <div class="ppacts">${F.map(([k, lbl]) => `<button class="ppb" aria-pressed="${on(k)}" data-a="pprdopen" data-v="${esc(k)}" data-h="selection" style="${on(k) ? `background:rgb(242 210 111 / 0.18);color:var(--ki-yellow-text, ${C.yellow || '#f2d26f'})` : ''}">${ic(on(k) ? 'mdi:chevron-down-circle' : 'mdi:chevron-right-circle-outline', 18)}${esc(lbl)}</button>`).join('')}
      ${l ? `<button class="ppb" data-a="pprdreset">${ic('mdi:restore', 18)}Standard</button>` : ''}</div></div>`;
  }

  function renderNew(ed) {
    const u = ed.u, hass = ed.hass, t = u.ppTpl || 'fn';
    const areas = M.areas(hass);
    const area = u.ppArea || (areas[0] && areas[0].id) || '';
    return `<div style="display:flex;flex-direction:column;gap:14px" data-key="ppnewv"><style>${CSS}</style>
      <div class="pphd"><button class="b40" data-a="ppback">${ic('mdi:chevron-left', 18)}</button><span class="t">Ny popup</span><button class="done press" data-a="ppcreate">Fortsett</button></div>
      <span class="fl" style="padding:0 4px">Velg mal</span>
      <div class="ppt">
        <button class="${t === 'fn' ? 'on' : ''}" data-a="pptpl" data-v="fn" data-h="selection">${ic('mdi:apps', 26)}Funksjon<i>Mal A</i></button>
        <button class="${t === 'rom' ? 'on' : ''}" data-a="pptpl" data-v="rom" data-h="selection">${ic('mdi:texture-box', 26)}Rom<i>Mal B · velg område</i></button>
        <button class="${t === 'tom' ? 'on' : ''}" data-a="pptpl" data-v="tom" data-h="selection">${ic('mdi:code-braces', 26)}Tom<i>Bare det nødvendige</i></button>
      </div>
      ${t === 'rom' ? `<div class="fld"><span class="fl">Område</span><select class="in" data-in="pparea">${areas.map((a) => `<option value="${esc(a.id)}" ${a.id === area ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>` : ''}
      <span class="hint">Popupen åpnes i YAML-editoren og lagres først når du trykker «Ferdig». Hashen må være unik.</span>
    </div>`;
  }

  function renderExport(ed) {
    const d = ed.u.pd;
    return `<div style="display:flex;flex-direction:column;gap:12px" data-key="ppexp"><style>${CSS}</style>
      <div class="pphd"><button class="b40" data-a="ppback">${ic('mdi:chevron-left', 18)}</button><span class="t">Eksporter popups</span><button class="done press" data-a="ppback">Ferdig</button></div>
      <span class="hint">Egne popups og overstyringer fra dashbordet. Lim inn under <b>strategy:</b> i dashbordets rå konfigurasjon for å gjøre dem til strategi-YAML (fjern dem deretter her, ellers rapporteres kollisjon).</span>
      <div class="ppcode" data-nomorph data-key="ppc-${d.id}"></div>
      <div class="ppacts"><button class="ppb" data-a="ppcopy">${ic('mdi:content-copy', 18)}Kopier YAML</button><button class="ppb" data-a="ppdl">${ic('mdi:download', 18)}Last ned</button></div>
    </div>`;
  }

  const rng = (f, label, val, max) => `<div class="fld"><span class="fl">${label}</span><div class="rw"><input type="range" min="0" max="${max}" step="1" data-in="ppf" data-f="${f}" value="${esc(val === '' || val == null ? '' : Number(val))}"><span class="rv">${val === '' || val == null ? 'std' : esc(val)}</span>${val !== '' && val != null ? `<button class="std" data-a="ppfclr" data-f="${f}">Standard</button>` : ''}</div></div>`;
  const HDR_RX = /(#header-container\s*>\s*div\s*>\s*div\s*\{\s*background(?:-color)?\s*:\s*)([^;!}]*)/;
  const ICON_RX = /(\.icon-container\s*\{\s*background-color\s*:\s*)([^;!}]*)/;
  function formVals(obj) {
    const st = typeof obj.styles === 'string' ? obj.styles : '';
    const m1 = ICON_RX.exec(st), m2 = HDR_RX.exec(st);
    return { iconcol: m1 ? m1[2].trim() : '', hdrcol: m2 ? m2[2].trim() : '' };
  }
  function colRow(f, label, cur) {
    return `<div class="fld"><span class="fl">${label}</span><div class="ppsw">${COLS.map((x) => `<button class="${cur === x ? 'on' : ''}" data-a="ppfcol" data-f="${f}" data-v="${esc(x)}" style="background:${M.color(x, x)}" title="${esc(x)}"></button>`).join('')}</div>
      <input class="in" data-in="ppf" data-f="${f}" value="${esc(cur || '')}" placeholder="var(--gray200) / #3a3a3a"></div>`; // ki-hex-ok: eksempeltekst i plassholderen
  }
  function renderForm(ed, d) {
    if (d.src === 'auto') {
      const e = entryOf(ed, d.hash0) || {}, key = d.hash0.slice(1), o = userPops(ed)[key] || {};
      const col = M.color(o.color || e.color || 'var(--gray1000)', C.gray1000);
      return `<div class="ppf" data-key="ppf-auto">
        <div class="fld"><span class="fl">Navn</span><input class="in" data-in="popname" data-k="${esc(key)}" value="${esc(o.name || '')}" placeholder="${esc(e.name || '')}"></div>
        <div class="fld"><span class="fl">Ikon · mdi:, phu:, hue: …</span><div class="rw"><span class="pv2" style="background:${col}">${ic(o.icon || e.icon, 22)}</span><input class="in" style="flex:1" data-in="popicon" data-k="${esc(key)}" value="${esc(o.icon || '')}" placeholder="${esc(e.icon || '')}"></div></div>
        <div class="fld"><span class="fl">Ikonfarge</span><div class="ppsw">${COLS.map((x) => `<button class="${o.color === x ? 'on' : ''}" data-a="popcol" data-k="${esc(key)}" data-v="${esc(x)}" style="background:${M.color(x, x)}"></button>`).join('')}</div></div>
        ${o.name || o.icon || o.color ? `<button class="std" style="align-self:flex-start;height:32px;padding:0 12px" data-a="popreset" data-v="${esc(key)}">Standard</button>` : ''}
        ${gapRow(ed, key)}
        <span class="hint" style="padding:0">Vil du endre mer (bredde, bakgrunn, kort …)? Bytt til YAML – lagring gjør popupen «Overstyrt».</span>
      </div>`;
    }
    const obj = d.v && !d.v.err ? d.v.obj : null;
    if (!obj) return `<div class="ppwarn err" data-key="ppf-bad">${ic('mdi:alert-circle-outline', 20)}<span>Skjemaet krever gyldig YAML – rett feilen i YAML-modus først.</span></div>`;
    const F = formVals(obj), dis = d.ro ? 'disabled' : '';
    return `<div class="ppf" data-key="ppf-${d.id}">
      <div class="fld"><span class="fl">Navn</span><input class="in" data-in="ppf" data-f="name" value="${esc(obj.name || '')}" ${dis}></div>
      <div class="fld"><span class="fl">Ikon · mdi:, phu:, hue: …</span><div class="rw"><span class="pv2" style="background:${M.color(F.iconcol || 'var(--gray1000)', C.gray1000)}">${ic(obj.icon || 'mdi:card-outline', 22)}</span><input class="in" style="flex:1" data-in="ppf" data-f="icon" value="${esc(obj.icon || '')}" ${dis}></div></div>
      <div class="fld"><span class="fl">Hash</span><input class="in" data-in="ppf" data-f="hash" value="${esc(obj.hash || '')}" ${dis || (d.src === 'over' ? 'disabled' : '')}></div>
      <div class="fld"><span class="fl">Bredde på PC (width_desktop)</span><input class="in" data-in="ppf" data-f="width_desktop" value="${esc(obj.width_desktop || '')}" placeholder="540px" ${dis}></div>
      ${rng('bg_opacity', 'Bakgrunn · opasitet (bg_opacity)', obj.bg_opacity, 100)}
      ${rng('bg_blur', 'Bakgrunn · blur (bg_blur)', obj.bg_blur, 50)}
      ${colRow('bg_color', 'Bakgrunnsfarge (bg_color)', obj.bg_color || '')}
      ${colRow('iconcol', 'Header · ikonfarge', F.iconcol)}
      ${colRow('hdrcol', 'Header · bakgrunn', F.hdrcol)}
      ${obj.hash && HASH_RX.test(String(obj.hash)) && !d.ro ? gapRow(ed, String(obj.hash).slice(1)) : ''}
    </div>`;
  }
  function errBox(d) {
    const e = d.v && d.v.err;
    return `<div data-key="pperr" class="pperrw">${e ? `<div class="ppwarn err">${ic('mdi:alert-circle-outline', 20)}<span>${e.line ? `<b>Linje ${e.line}:</b> ` : ''}${esc(e.msg)}</span></div>` : ''}</div>`;
  }
  function renderItem(ed) {
    const u = ed.u, d = u.pd, e = entryOf(ed, d.hash0);
    const obj = d.v && d.v.obj;
    const title = (obj && obj.name) || (e && e.name) || 'Ny popup';
    const valid = !(d.v && d.v.err);
    const col = (e && (M.popupReport.collisions || []).find((c) => c.hash === d.hash0)) || null;
    const lbl = d.src === 'new' ? 'Ny' : d.src === 'custom' ? 'Egen' : d.src === 'yaml' ? 'YAML' : d.src === 'over' || d.src === 'yamlov' ? 'Overstyrt' : 'Auto';
    const editable = !d.ro;
    const segs = editable || d.src === 'auto' ? `<div class="seg" data-key="ppseg">${[['form', 'Skjema'], ['yaml', 'YAML']].map(([m, l]) => `<button class="${d.mode === m ? 'on-pk' : ''}" data-a="ppmode" data-v="${m}" data-h="selection">${l}</button>`).join('')}</div>` : '';
    const sync = editable && d.mode === 'yaml' && d.src !== 'auto' ? `<div class="rw" style="display:flex;gap:8px" data-key="ppsync">
        <div class="fld" style="flex:1.3"><span class="fl">Navn</span><input class="in" data-in="ppname" value="${esc((obj && obj.name) || '')}"></div>
        <div class="fld" style="flex:1"><span class="fl">Hash</span><input class="in" data-in="pphash" value="${esc((obj && obj.hash) || '')}" ${d.src === 'over' ? 'disabled' : ''}></div></div>
        ${iconField(d, obj)}` : '';
    const raw = d.src === 'custom' ? customList()[d.index] : null;
    const ent = e || null;
    const missC = obj ? M.popupMissingCards(obj) : [];
    const missT = obj && (d.src === 'custom' || d.src === 'new') ? missingTemplates([obj]) : [];
    const infos = [
      missC.length ? `<div class="ppwarn" data-key="ppmissc">${ic('mdi:puzzle-remove-outline', 20)}<span><b>Mangler kort: ${esc(missC.join(', '))}</b> – popupen lagres likevel og viser HAs feilkort til kortet er installert (HACS/ressurs).</span></div>` : '',
      missT.length ? `<div class="ppwarn" data-key="ppmisst">${ic('mdi:file-alert-outline', 20)}<span>Popupen bruker maler som mangler: <b>${esc(missT.join(', '))}</b><br><button class="ppb" data-a="ppimport" data-v="globals">${ic('mdi:import', 18)}Importer maler</button></span></div>` : '',
      ent && ent.replacesAuto ? `<div class="ppnote" data-key="pprepl">${ic('mdi:swap-horizontal', 20)}<span style="flex:1">Erstatter den autogenererte popupen ${esc(ent.hash)}.<br><button class="ppb" style="margin-top:6px" data-a="ppprefer" data-v="${esc(ent.hash)}" data-p="auto">Bruk autogenerert</button></span></div>` : '',
      ent && ent.preferAuto ? `<div class="ppnote" data-key="pppref">${ic('mdi:swap-horizontal', 20)}<span style="flex:1">En egen popup med samme hash er slått av – den autogenererte brukes.<br><button class="ppb" style="margin-top:6px" data-a="ppprefer" data-v="${esc(ent.hash)}" data-p="custom">Bruk egen popup</button></span></div>` : '',
      raw && isWrap(raw) && raw.imported ? `<div class="ppmeta" data-key="ppimpd">${ic('mdi:import', 16)}<span>Importert fra ${esc(raw.imported)} · YAML-en lagres som du skriver den</span></div>` : '',
    ].join('');
    const acts = [];
    if (d.mode === 'yaml' || d.ro) acts.push(`<button class="ppb" data-a="pppreview">${ic('mdi:eye-outline', 18)}Forhåndsvis</button>`, `<button class="ppb" data-a="ppcopy">${ic('mdi:content-copy', 18)}Kopier YAML</button>`);
    else acts.push(`<button class="ppb" data-a="pppreview">${ic('mdi:eye-outline', 18)}Forhåndsvis</button>`);
    if (d.src === 'over') acts.push(`<button class="ppb" data-a="ppreset">${ic('mdi:restore', 18)}Tilbakestill til generert</button>`);
    if (d.src === 'yaml') acts.push(`<button class="ppb" data-a="ppclone">${ic('mdi:content-duplicate', 18)}Kopier til Egne</button>`);
    if (d.src === 'custom') acts.push(`<button class="ppb" data-a="ppgo">${ic('mdi:open-in-app', 18)}Åpne</button>`, `<button class="ppb" data-a="ppdup">${ic('mdi:content-duplicate', 18)}Dupliser</button>`, `<button class="ppb" data-a="ppdl1">${ic('mdi:download', 18)}Eksporter YAML</button>`);
    if (d.src === 'custom') acts.push(d.confirmDel ? `<button class="ppb redf" data-a="ppdel" data-h="warning">${ic('mdi:delete', 18)}Bekreft sletting</button><button class="ppb" data-a="ppdelno">Avbryt</button>` : `<button class="ppb red" data-a="ppdelask">${ic('mdi:delete-outline', 18)}Slett</button>`);
    const done = d.ro ? `<button class="done press" data-a="ppback">Ferdig</button>` : `<button class="done press" data-a="ppsave" data-key="ppsave" ${valid ? '' : 'disabled'}>Ferdig</button>`;
    return `<div style="display:flex;flex-direction:column;gap:12px" data-key="ppitem-${d.id}"><style>${CSS}</style>
      <div class="pphd"><button class="b40" data-a="ppback" title="Avbryt">${d.dirty && editable ? 'Avbryt' : ic('mdi:chevron-left', 18)}</button><span class="t">${esc(title)}</span>${done}</div>
      <div class="ppmeta">${chip(lbl)}<span>${esc((obj && obj.hash) || d.hash0 || '')}</span>${e && e.hidden ? chip('Skjult') : ''}${d.dirty && editable ? '<span>· ulagret</span>' : ''}</div>
      ${d.note ? `<div class="ppnote">${ic('mdi:information-outline', 20)}<span>${esc(d.note)}</span></div>` : ''}
      ${col && col.kind !== 'replace' ? `<div class="ppwarn">${ic('mdi:alert-outline', 20)}<span>Samme hash finnes også i ${col.losers.map((l) => esc(SRCLONG[l])).join(' og ')} – ${esc(SRCLONG[col.winner])} brukes.</span></div>` : ''}
      ${infos}
      ${segs}
      ${d.mode === 'form' && !d.ro ? renderForm(ed, d) : `${sync}<div class="ppcode" data-nomorph data-key="ppc-${d.id}"></div>${errBox(d)}`}
      <div class="ppacts" data-key="ppacts">${acts.join('')}</div>
      ${d.src === 'auto' && d.mode === 'yaml' ? '<span class="hint">Dette er den genererte configen. Endrer du den og trykker «Ferdig», lagres den som overstyring (popup_overrides) – «Tilbakestill til generert» angrer.</span>' : ''}
    </div>`;
  }

  /* Ikonfelt (synkes mot «icon:» i YAML-en): felles ikonvelger (MSH.iconPicker) når den finnes, ellers ha-icon-picker,
   * ellers tekstfelt med forhåndsvisning. */
  function iconField(d, obj) {
    const v = (obj && obj.icon) || '';
    const pv = `<span class="pv2" style="background:var(--ki-bg, var(--gray000,#232323))">${ic(v || 'mdi:card-outline', 22)}</span>`;
    let f;
    if (M.iconPicker && (typeof M.iconPicker === 'function' || typeof M.iconPicker.open === 'function')) f = `${pv}<button class="in" style="flex:1;text-align:left" data-a="ppiconpick">${esc(v || 'Velg ikon')}</button>${v ? `<button class="std" data-a="ppiconclr">×</button>` : ''}`;
    else if (customElements.get('ha-icon-picker')) f = `<ha-icon-picker data-in="ppiconha" data-val="${esc(v)}" data-nomorph data-key="ppiconha-${d.id}"></ha-icon-picker>`;
    else f = `${pv}<input class="in" style="flex:1" data-in="ppicon" value="${esc(v)}" placeholder="mdi:star">`;
    return `<div class="fld" data-key="ppicf"><span class="fl">Ikon</span><div class="ppicf">${f}</div></div>`;
  }
  function setIcon(ed, v) {
    const d = ed.u.pd; if (!d || d.ro) return;
    v = String(v || '').trim();
    let t;
    if (v) t = setTopKey(d.text, 'icon', v);
    else { try { const o = Yp(d.text); delete o.icon; t = d.text.replace(/^(['"]?)icon\1\s*:.*\n?/m, ''); if (JSON.stringify(Yp(t)) !== JSON.stringify(o)) t = Yd(o); } catch (e) { return; } }
    setText(ed, t);
    ed.render();
  }

  /* ------------------------------------------------------------ import */
  const ROOT_POP = (o) => isObj(o) && o.type === 'custom:bubble-card' && o.card_type === 'pop-up';
  // Finn Bubble-popups nestet i en større config (hele dashbord-YAML, vertical-stack …)
  function findPopups(v, out, d) {
    out = out || [];
    if (d > 30 || v == null || typeof v !== 'object') return out;
    if (Array.isArray(v)) { v.forEach((x) => findPopups(x, out, (d || 0) + 1)); return out; }
    if (ROOT_POP(v)) { out.push(v); return out; }
    Object.keys(v).forEach((k) => findPopups(v[k], out, (d || 0) + 1));
    return out;
  }
  /* Tekst (YAML eller TextEdit-HTML) → { popups: [{ text, cfg, err, line }], globals: { text, obj } | null }
   *   Popups: ett dokument per «type: custom:bubble-card» på rotnivå (teksten beholdes uendret), ellers popups funnet i
   *   en liste / custom_popups: / et helt dashbord (skrives ut på nytt). Globale nøkler: rotnøkler som ikke er popup-felt. */
  function analyse(raw) {
    const text = M.yaml.toText(raw);
    const out = { popups: [], globals: null, err: null };
    const docs = M.yaml.splitDocs(text);
    const rest = [];
    docs.forEach((doc) => {
      let v;
      try { v = Yp(doc.text); } catch (e) {
        if (/^type:\s*['"]?custom:bubble-card/m.test(doc.text)) out.popups.push({ text: doc.text, cfg: null, err: { msg: e.reason || e.message, line: e.line ? e.line + doc.line - 1 : null } });
        else out.err = { msg: e.reason || e.message, line: e.line ? e.line + doc.line - 1 : null };
        return;
      }
      if (ROOT_POP(v)) out.popups.push({ text: doc.text, cfg: v, err: null, line: doc.line });
      else rest.push({ v, doc });
    });
    rest.forEach(({ v, doc }) => {
      if (Array.isArray(v)) { findPopups(v).forEach((c) => out.popups.push({ text: Yd(c), cfg: c, err: null })); return; }
      if (!isObj(v)) return;
      const nested = findPopups(v);
      nested.forEach((c) => out.popups.push({ text: Yd(c), cfg: c, err: null }));
      const gk = Object.keys(v).filter((k) => !['views', 'strategy', 'title', 'custom_popups', 'popup_overrides', 'type', 'cards'].includes(k) && isObj(v[k]));
      if (!gk.length) return;
      const obj = {}; gk.forEach((k) => { obj[k] = v[k]; });
      // hele dokumentet er globale nøkler → behold teksten uendret
      const whole = gk.length === Object.keys(v).length && !nested.length;
      out.globals = { text: whole ? doc.text : Yd(obj), obj };
    });
    return out;
  }
  function renderImport(ed) {
    const u = ed.u, I = u.imp || (u.imp = { text: '', kind: null });
    const A = I.res;
    const inUse = new Set(entries(ed).entries.map((e) => e.hash));
    const ownH = new Map(customList().map((c, i) => [String((cfgOf(c) || c || {}).hash || ''), i]));
    const st = (p) => {
      if (p.err) return `<span class="ppmiss">Ugyldig YAML${p.err.line ? ` · linje ${p.err.line}` : ''}: ${esc(p.err.msg)}</span>`;
      const h = normH(p.cfg.hash);
      if (!HASH_RX.test(h)) return `<span class="ppmiss">Ugyldig hash «${esc(p.cfg.hash || '')}»</span>`;
      const e = entries(ed).entries.find((x) => x.hash === h);
      const m = M.popupMissingCards(p.cfg);
      const bits = [kortN(nCards(p.cfg))];
      if (ownH.has(h)) bits.push('oppdaterer egen popup');
      else if (e && e.source === 'yaml') bits.push('finnes i strategi-YAML (den vinner)');
      else if (e && e.source === 'auto' || (R0().replaced || []).some((x) => x.hash === h)) bits.push('erstatter autogenerert');
      else if (inUse.has(h)) bits.push('hash i bruk');
      else bits.push('ny');
      return esc(bits.join(' · ')) + (m.length ? `<br><span class="ppmiss">Mangler kort: ${esc(m.join(', '))}</span>` : '');
    };
    const sel = I.sel || {};
    const chk = (k, on, bad, icon, name, sub) => `<button class="ppchk ${on ? 'on' : ''} ${bad ? 'bad' : ''}" data-a="ppimpchk" data-v="${k}" data-h="selection" ${bad ? 'disabled' : ''}><span class="bx">${on ? ic('mdi:check', 18) : ''}</span><span class="pi" style="background:var(--ki-surface-2, var(--gray300,#404040))">${ic(icon, 22)}</span><span class="pn"><b>${esc(name)}</b><i>${sub}</i></span></button>`;
    let list = '';
    if (A) {
      const G = A.globals && A.globals.obj, cnt = (k) => Object.keys((G && isObj(G[k]) && G[k]) || {}).length;
      if (A.globals) list += chk('g', sel.g !== false, false, 'mdi:file-code-outline', 'Maler og globale innstillinger', esc([cnt('button_card_templates') && `${cnt('button_card_templates')} button_card_templates`, cnt('decluttering_templates') && `${cnt('decluttering_templates')} decluttering_templates`, G.paper_buttons_row && 'paper_buttons_row', ...Object.keys(G).filter((k) => !GLOBAL_KEYS.includes(k))].filter(Boolean).join(' · ')) + (globalsText() ? ' · slås sammen med eksisterende (samme navn erstattes)' : ''));
      A.popups.forEach((p, i) => { const bad = !!p.err || !HASH_RX.test(normH(p.cfg && p.cfg.hash)); list += chk(i, !bad && sel[i] !== false, bad, (p.cfg && p.cfg.icon) || 'mdi:card-outline', (p.cfg && (p.cfg.name || p.cfg.hash)) || 'Popup ' + (i + 1), st(p)); });
      if (!A.globals && !A.popups.length) list = `<div class="ppwarn err" data-key="ppimperr">${ic('mdi:alert-circle-outline', 20)}<span>${A.err ? `YAML-feil${A.err.line ? ` på <b>linje ${A.err.line}</b>` : ''} i den konverterte teksten: ${esc(A.err.msg)}` : 'Fant ingen Bubble Card-popups (type: custom:bubble-card, card_type: pop-up) eller maler i teksten.'}</span></div>`;
      else if (A.err) list = `<div class="ppwarn err" data-key="ppimperr">${ic('mdi:alert-circle-outline', 20)}<span>YAML-feil${A.err.line ? ` på <b>linje ${A.err.line}</b>` : ''} i den konverterte teksten (hoppet over): ${esc(A.err.msg)}</span></div>` + list;
      const anyErr = !!A.err || A.popups.some((p) => p.err);
      if (anyErr || I.showConv) list += `<button class="ppb" style="align-self:flex-start" data-a="ppimpconv" data-key="ppimpconvb">${ic(I.showConv ? 'mdi:eye-off-outline' : 'mdi:code-braces', 18)}${I.showConv ? 'Skjul konvertert YAML' : 'Vis konvertert YAML'}</button>${I.showConv ? convView(I) : ''}`;
    }
    const n = A ? (A.globals && sel.g !== false ? 1 : 0) + A.popups.filter((p, i) => !p.err && HASH_RX.test(normH(p.cfg.hash)) && sel[i] !== false).length : 0;
    const hacs = A ? M.missingHacs() : [];
    return `<div style="display:flex;flex-direction:column;gap:12px" data-key="ppimpv"><style>${CSS}</style>
      <div class="pphd"><button class="b40" data-a="ppback">${ic('mdi:chevron-left', 18)}</button><span class="t">${I.kind === 'globals' ? 'Importer maler' : 'Importer popups'}</span><button class="done press" data-a="ppimpdo" ${n ? '' : 'disabled'}>Importer${n ? ' ' + n : ''}</button></div>
      <span class="hint">Lim inn YAML, eller last opp en fil (.yaml, .txt eller TextEdit-eksport .html). Flere popups etter hverandre deles ved hver <b>type: custom:bubble-card</b>. ${I.kind === 'globals' ? 'Maler (button_card_templates, decluttering_templates, paper_buttons_row) legges i «Maler og globale innstillinger».' : 'Importer gjerne malene (dependencies) først.'} YAML-en lagres uendret.</span>
      <div class="ppimp" data-key="ppimpin">
        <textarea data-in="ppimptext" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" placeholder="type: custom:bubble-card&#10;card_type: pop-up&#10;hash: '#min-popup'&#10;…">${esc(I.text || '')}</textarea>
        <div class="ppacts"><button class="ppb" data-a="ppimpread">${ic('mdi:magnify', 18)}Les teksten</button><label class="ppb ppfile">${ic('mdi:file-upload-outline', 18)}Last opp fil<input type="file" accept=".yaml,.yml,.txt,.html,.htm,text/yaml,text/plain,text/html" data-in="ppimpfile"></label>${I.file ? `<span class="hint" style="align-self:center">${esc(I.file)}</span>` : ''}</div>
      </div>
      ${A ? `<span class="fl" style="padding:0 4px">Funnet – kryss av det som skal importeres</span><div style="display:flex;flex-direction:column;gap:6px" data-key="ppimplist">${list}</div>` : ''}
      ${hacs.length ? `<div class="ppwarn">${ic('mdi:puzzle-remove-outline', 20)}<span><b>Mangler: ${esc(hacs.join(', '))} (HACS)</b> – importen går likevel, men kortene vises som feil til de er installert.</span></div>` : ''}
    </div>`;
  }
  // Resultatet av siste import (vises øverst i listen og i «Maler og globale innstillinger» til neste import)
  const impNote = (u) => (u && u.impRes ? `<div class="${u.impRes.err ? 'ppwarn err' : 'ppnote'}" data-key="ppimpres">${ic(u.impRes.err ? 'mdi:alert-circle-outline' : 'mdi:check-circle-outline', 20)}<span>${esc(u.impRes.msg)}</span></div>` : '');
  // «Vis konvertert YAML»: teksten etter HTML → YAML-konverteringen med linjenumre, feillinjen markert
  function convView(I) {
    const A = I.res, errs = new Set();
    if (A && A.err && A.err.line) errs.add(A.err.line);
    if (A) A.popups.forEach((p) => { if (p.err && p.err.line) errs.add(p.err.line); });
    const L = String(I.conv || '').split('\n');
    return `<div class="ppconv" data-key="ppconv">${L.map((l, i) => `<div class="${errs.has(i + 1) ? 'bad' : ''}"${errs.has(i + 1) ? ' data-errline' : ''}><i>${i + 1}</i><span>${esc(l) || ' '}</span></div>`).join('')}</div>`;
  }
  const normH = (h) => { const x = String(h == null ? '' : h).trim(); return x ? (x[0] === '#' ? x : '#' + x) : ''; };
  const R0 = () => M.popupReport || {};
  function doImport(ed) {
    const u = ed.u, I = u.imp, A = I && I.res;
    if (!A) return;
    const sel = I.sel || {}, src = I.file || 'innliming';
    let nP = 0, nG = 0;
    if (A.globals && sel.g !== false) {
      const cur = globalsText();
      let val;
      if (!cur.trim()) val = { yaml: A.globals.text.endsWith('\n') ? A.globals.text : A.globals.text + '\n' };
      else {
        let old = {}; try { old = Yp(cur) || {}; } catch (e) { old = {}; }
        const mg = { ...old };
        Object.keys(A.globals.obj).forEach((k) => { mg[k] = isObj(old[k]) && isObj(A.globals.obj[k]) ? { ...old[k], ...A.globals.obj[k] } : A.globals.obj[k]; });
        val = { yaml: Yd(mg) };
      }
      const p = save(ed, 'dashboard_globals', val); nG = 1;
      // Resultat fra samme kilde som advarselen og strategien (MSH.globalsInfo): «Importert: 40 button-card-maler, …»
      const gi = M.globalsInfo(val);
      u.impRes = gi.err ? { err: true, msg: `Malene ble lagret, men YAML-en har en feil${gi.err.line ? ` på linje ${gi.err.line}` : ''}: ${gi.err.msg}` } : { msg: 'Importert: ' + M.globalsSummary(gi.counts) };
      if (p && p.then) p.then((r) => { if (r && r.ok === false) { u.impRes = { err: true, msg: 'Malene ble ikke lagret i Home Assistant: ' + (r.error || 'ukjent feil') }; ed.render(); } });
    }
    const L = customList().slice();
    A.popups.forEach((p, i) => {
      if (p.err || sel[i] === false) return;
      const h = normH(p.cfg.hash);
      if (!HASH_RX.test(h)) return;
      let t = p.text.endsWith('\n') ? p.text : p.text + '\n';
      if (p.cfg.hash !== h) t = setTopKey(t, 'hash', h);
      const at = L.findIndex((c) => normH((cfgOf(c) || c || {}).hash) === h);
      const w = { id: at >= 0 && isWrap(L[at]) && L[at].id ? L[at].id : newId(), hash: h, name: p.cfg.name || '', icon: p.cfg.icon || '', yaml: t, imported: src };
      if (at >= 0) L[at] = w; else L.push(w);
      nP++;
    });
    if (nP) save(ed, 'custom_popups', L);
    M.haptic('success');
    if (nP && !nG) u.impRes = { msg: `Importert: ${nP} popup${nP === 1 ? '' : 's'}` };
    else if (nP && u.impRes && !u.impRes.err) u.impRes.msg += ` og ${nP} popup${nP === 1 ? '' : 's'}`;
    M.toast(u.impRes ? u.impRes.msg : 'Importert');
    const ret = I.ret;
    u.imp = null;
    if (ret === 'globals') { u.pd = globalsDraft(ed); u.pv = 'globals'; ed.render(); return; }
    back(ed);
  }
  function readImport(ed, text, file) {
    const I = ed.u.imp || (ed.u.imp = {});
    I.text = M.yaml.isCocoaHtml(text) ? M.yaml.toText(text) : text;
    if (file) I.file = file;
    I.conv = M.yaml.toText(text); I.showConv = false;
    I.res = analyse(text); I.sel = {};
    if (I.kind === 'globals' && I.res.popups.length && I.res.globals) I.res.popups.forEach((p, i) => { I.sel[i] = false; });
    ed.render();
  }

  /* ------------------------------------------------------------ maler og globale innstillinger */
  function globalsDraft(ed) {
    const d = { id: 'g' + ++seq, src: 'globals', hash0: null, mode: 'yaml', dirty: false, text: globalsText() };
    d.v = validate(ed, d);
    return d;
  }
  function renderGlobals(ed) {
    const d = ed.u.pd, valid = !(d.v && d.v.err), o = d.dirty ? (d.v && d.v.obj) || {} : globalsObj();
    const cnt = (k) => Object.keys(isObj(o[k]) ? o[k] : {}).length;
    const hacs = M.missingHacs(), mt = missingTemplates();
    const used = new Set(); customList().map(cfgOf).forEach((c) => { if (c) templateRefs(c).forEach((t) => used.add(t)); });
    return `<div style="display:flex;flex-direction:column;gap:12px" data-key="ppglobv"><style>${CSS}</style>
      <div class="pphd"><button class="b40" data-a="ppback" title="Avbryt">${d.dirty ? 'Avbryt' : ic('mdi:chevron-left', 18)}</button><span class="t">Maler og globale innstillinger</span><button class="done press" data-a="ppsave" data-key="ppsave" ${valid ? '' : 'disabled'}>Ferdig</button></div>
      <div class="ppmeta">${chip('Egen')}<span>${cnt('button_card_templates')} button_card_templates · ${cnt('decluttering_templates')} decluttering_templates · paper_buttons_row: ${isObj(o.paper_buttons_row) ? Object.keys(o.paper_buttons_row.presets || o.paper_buttons_row).join(', ') || 'ja' : '–'}</span>${d.dirty ? '<span>· ulagret</span>' : ''}</div>
      <span class="hint">Dashbord-globale nøkler som legges på rotnivå i dashbordet (der button-card, decluttering-card og paper-buttons-row finner dem). ${used.size ? `Egne popups bruker ${used.size} maler.` : ''} Endringer oppdaterer dashbordet (som «Oppdater» – åpen popup lukkes).</span>
      ${impNote(ed.u)}
      ${mt.length ? `<div class="ppwarn">${ic('mdi:file-alert-outline', 20)}<span>Popupene bruker maler som mangler: <b>${esc(mt.join(', '))}</b></span></div>` : ''}
      ${hacs.length ? `<div class="ppwarn" data-key="pphacsg">${ic('mdi:puzzle-remove-outline', 20)}<span><b>Mangler: ${esc(hacs.join(', '))} (HACS)</b></span></div>` : `<div class="ppnote">${ic('mdi:check-circle-outline', 20)}<span>Alle HACS-kortene er installert (button-card, decluttering-card, paper-buttons-row, layout-card, my-cards, mini-graph-card, expander-card, simple-tabs, bubble-card, gap-card).</span></div>`}
      <div class="ppcode" data-nomorph data-key="ppc-${d.id}"></div>${errBox(d)}
      <div class="ppacts"><button class="ppb" data-a="ppimport" data-v="globals">${ic('mdi:import', 18)}Importer</button><button class="ppb" data-a="ppcopy">${ic('mdi:content-copy', 18)}Kopier YAML</button><button class="ppb" data-a="ppdlg">${ic('mdi:download', 18)}Eksporter</button></div>
    </div>`;
  }

  /* ------------------------------------------------------------ kode-editor */
  function refreshStatus(ed) {
    const d = ed.u.pd; if (!d) return;
    const r = ed.root;
    const b = r.querySelector('[data-key="ppsave"]'); if (b) b.disabled = !!(d.v && d.v.err);
    const w = r.querySelector('.pperrw');
    if (w) { const e = d.v && d.v.err; w.innerHTML = e ? `<div class="ppwarn err">${ic('mdi:alert-circle-outline', 20)}<span>${e.line ? `<b>Linje ${e.line}:</b> ` : ''}${esc(e.msg)}</span></div>` : ''; }
    const obj = d.v && d.v.obj;
    if (obj) ['ppname', 'pphash'].forEach((k) => { const i = r.querySelector(`[data-in="${k}"]`); const v = String((k === 'ppname' ? obj.name : obj.hash) || ''); if (i && i !== r.activeElement && i.value !== v) i.value = v; });
    const t = r.querySelector('.pphd .t'); if (t && obj && obj.name) t.textContent = obj.name;
    const g = r.querySelector('.ppgut'); if (g) paintGutter(g, d);
  }
  function paintGutter(g, d) {
    const n = String(d.text).split('\n').length, bad = d.v && d.v.err && d.v.err.line;
    let h = '';
    for (let i = 1; i <= n; i++) h += (i === bad ? `<span class="bad">${i}</span>` : i) + '\n';
    g.innerHTML = h;
  }
  let vt = 0;
  function onText(ed, text) {
    const d = ed.u.pd; if (!d || d.ro) return;
    d.text = text; d.dirty = true;
    if (d.src === 'new') { /* hash følger navnet til den settes manuelt */ }
    clearTimeout(vt);
    const g = ed.root.querySelector('.ppgut'); if (g) paintGutter(g, d);
    vt = setTimeout(() => { if (ed.u.pd !== d) return; d.v = validate(ed, d); refreshStatus(ed); }, 150);
  }
  function mount(ed) {
    const host = ed.root.querySelector('.ppcode');
    const d = ed.u.pd;
    if (!host || !d || host.__id === d.id) return;
    host.__id = d.id; host.innerHTML = '';
    const ro = !!d.ro || ed.u.pv === 'export';
    if (customElements.get('ha-code-editor') && !M.__ppNoCodeEditor) {
      const ce = document.createElement('ha-code-editor');
      ce.mode = 'yaml'; ce.hass = ed.hass; ce.readOnly = ro; ce.autocompleteEntities = true; ce.autocompleteIcons = true;
      ce.value = d.text;
      ce.addEventListener('value-changed', (e) => { e.stopPropagation(); onText(ed, e.detail && e.detail.value != null ? e.detail.value : ce.value); });
      host.appendChild(ce);
      host.__set = (t) => { ce.value = t; };
      return;
    }
    host.innerHTML = `<div class="ppta ${ro ? 'ro' : ''}"><div class="ppgut"></div><textarea spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" ${ro ? 'readonly' : ''}></textarea></div>`;
    const ta = host.querySelector('textarea'), g = host.querySelector('.ppgut');
    ta.value = d.text; paintGutter(g, d);
    ta.addEventListener('input', (e) => { e.stopPropagation(); onText(ed, ta.value); });
    ta.addEventListener('scroll', () => { g.scrollTop = ta.scrollTop; });
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Tab' && !ro) { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); onText(ed, ta.value); }
      if (e.key === 'Escape') ta.blur();
    });
    host.__set = (t) => { if (ta.value !== t) { const s = ta.selectionStart; ta.value = t; try { ta.setSelectionRange(s, s); } catch (x) { /* */ } } paintGutter(g, ed.u.pd || d); };
  }
  const setText = (ed, t) => { const d = ed.u.pd; d.text = t; d.dirty = true; d.v = validate(ed, d); const h = ed.root.querySelector('.ppcode'); if (h && h.__set) h.__set(t); refreshStatus(ed); };

  /* ------------------------------------------------------------ API mot HomeEditor */
  M.popupsPanel = {
    render(ed) {
      if (!ed.__ppL) {
        ed.__ppL = () => { if (ed.closed) window.removeEventListener('ki-popups-updated', ed.__ppL); else ed._schedule(); };
        window.addEventListener('ki-popups-updated', ed.__ppL);
      }
      const u = ed.u;
      try {
        if (u.pv === 'strom' && M.powerPricePanel) return M.powerPricePanel.render(ed); // 29-strompris-editor.js
        if (u.pv === 'new') return renderNew(ed);
        if (u.pv === 'export' && u.pd) return renderExport(ed);
        if (u.pv === 'item' && u.pd) return renderItem(ed);
        if (u.pv === 'import') return renderImport(ed);
        if (u.pv === 'globals' && u.pd) return renderGlobals(ed);
      } catch (e) { console.error('[ki-msh] popups', e); }
      return renderList(ed);
    },
    after(ed) {
      if (ed.u.pv === 'strom' && M.powerPricePanel) return M.powerPricePanel.after(ed);
      if (ed.u.pd && (ed.u.pv === 'item' || ed.u.pv === 'export' || ed.u.pv === 'globals')) mount(ed);
      const ip = ed.root.querySelector('ha-icon-picker[data-in="ppiconha"]');
      if (ip) {
        ip.hass = ed.hass;
        const v = ip.getAttribute('data-val') || ''; if (ip.value !== v && !ip.__ppFocus) ip.value = v;
        if (!ip.__pp) { ip.__pp = true; ip.addEventListener('value-changed', (e) => { e.stopPropagation(); setIcon(ed, e.detail && e.detail.value); }); }
      }
    },
    act(ed, a, d) {
      const u = ed.u;
      if (a === 'ppvaer') { if (M.setVaerStil) Promise.resolve(M.setVaerStil(d.v)).then(() => ed.render()); ed.render(); return true; } // 26.24: Vær · Klassisk | Scene (kortets stil)
      if (a === 'ppring') { if (M.setDoorbell) M.setDoorbell(d.f || 'mode', d.v); ed.render(); return true; } // 19.18/20.1: «Når det ringer» + tid/utløser (per bruker × enhet)
      if (a === 'ppstrom') { u.pv = 'strom'; u.pd = null; u.ppMenu = false; ed.render(); return true; }
      if (u.pv === 'strom' && M.powerPricePanel && M.powerPricePanel.act(ed, a, d)) return true;
      switch (a) {
        case 'popg': u.popG = d.v; u.ppMenu = false; ed.render(); return true;
        case 'pprdopen': {
          const rd = store().room_defaults || {}, cur = Array.isArray(rd.open_on_start) ? rd.open_on_start : ['lys'];
          const nx = cur.includes(d.v) ? cur.filter((k) => k !== d.v) : [...cur, d.v];
          save(ed, 'room_defaults', { ...rd, open_on_start: nx }); ed.render(); return true;
        }
        case 'ppgapreset': gapSave(ed, d.k || null, undefined); ed.render(); return true; // 26.18
        case 'pprdreset': { const { open_on_start, ...rd } = store().room_defaults || {}; save(ed, 'room_defaults', Object.keys(rd).length ? rd : undefined); ed.render(); return true; }
        case 'ppmenu': u.ppMenu = !u.ppMenu; ed.render(); return true;
        case 'ppexport': u.ppMenu = false; u.pv = 'export'; u.pd = { id: 'x' + ++seq, text: exportText(), ro: true, src: 'export' }; ed.render(); return true;
        case 'ppdl': download(u.pd ? u.pd.text : exportText(), 'ki-popups.yaml'); return true;
        case 'ppnew': u.pv = 'new'; u.ppMenu = false; ed.render(); return true;
        case 'ppimport': u.impRes = null; u.imp = { text: '', kind: d.v === 'globals' ? 'globals' : null, ret: u.pv === 'globals' ? 'globals' : null }; u.pv = 'import'; u.pd = null; u.ppMenu = false; ed.render(); return true;
        case 'ppimpread': { const ta = ed.root.querySelector('[data-in="ppimptext"]'); readImport(ed, ta ? ta.value : (u.imp && u.imp.text) || ''); return true; }
        case 'ppimpchk': { const I = u.imp; if (!I) return true; I.sel = I.sel || {}; const k = d.v; I.sel[k] = I.sel[k] === false; ed.render(); return true; }
        case 'ppimpdo': doImport(ed); return true;
        case 'ppimpconv': { const I = u.imp; if (!I) return true; I.showConv = !I.showConv; ed.render(); if (I.showConv) setTimeout(() => { const e = ed.root.querySelector('.ppconv [data-errline]'); if (e) e.scrollIntoView({ block: 'center' }); }, 30); return true; }
        case 'ppglobals': u.ppMenu = false; u.pd = globalsDraft(ed); u.pv = 'globals'; ed.render(); return true;
        case 'ppdlg': download(u.pd ? u.pd.text : globalsText(), 'dashboard_globals.yaml'); return true;
        case 'ppexportown': u.ppMenu = false; download(exportCustomText(), 'egne-popups.yaml'); return true;
        case 'ppdl1': { const p = u.pd; download(p.text, `popup-${String((p.v && p.v.obj && p.v.obj.hash) || p.hash0 || 'popup').replace(/^#/, '')}.yaml`); return true; }
        case 'ppgo': {
          const p = u.pd, h = (p.v && p.v.obj && p.v.obj.hash) || p.hash0;
          if (p.dirty) { M.toast('Lagre («Ferdig») først – eller bruk Forhåndsvis'); return true; }
          if (!h) return true;
          // «Ferdig» for arket (lagrer utkastet når arket har et) → åpne popupen
          Promise.resolve(ed._done ? ed._done() : ed.close()).then(() => setTimeout(() => { if (ed.closed || !ed._done) location.hash = h; }, 250));
          return true;
        }
        case 'ppdup': {
          const p = u.pd, obj = p.v && p.v.obj; if (!obj) { M.toast('Rett feilen i YAML først'); return true; }
          const h = uniqueHash(ed, obj.hash + '-kopi');
          let t = setTopKey(setTopKey(p.text, 'hash', h), 'name', (obj.name || '') + ' (kopi)');
          u.pd = newDraft(ed, null, 'Kopi – lagres som egen popup når du trykker «Ferdig».', t); u.pd.hashAuto = false; ed.render(); return true;
        }
        case 'ppopenraw': { const i = Number(d.v); if (!(i >= 0 && i < customList().length)) return true; u.pd = draftRaw(ed, i); u.pv = 'item'; u.ppMenu = false; ed.render(); return true; }
        case 'ppprefer': {
          const key = String(d.v || '').replace(/^#/, ''); if (!key) return true;
          ed._popSet(key, { prefer: d.p === 'auto' ? 'auto' : 'custom' }); // 'custom': også når en generert popup ville erstattet den (23.8)
          M.toast(d.p === 'auto' ? 'Autogenerert popup brukes' : 'Egen popup brukes'); M.haptic('success');
          if (u.pv === 'item') back(ed); return true;
        }
        case 'ppiconclr': setIcon(ed, ''); return true;
        case 'ppiconpick': {
          const p = u.pd, cur = (p && p.v && p.v.obj && p.v.obj.icon) || '';
          const pick = (v) => { if (v != null && ed.u.pd === p) setIcon(ed, v); };
          try {
            const fn = typeof M.iconPicker === 'function' ? M.iconPicker : M.iconPicker.open.bind(M.iconPicker);
            // MSH.iconPicker.open({ value }) → Promise<full ID | '' (tømt) | null (avbrutt)> (09-icon-picker)
            const r = fn({ value: cur, hass: ed.hass });
            if (r && typeof r.then === 'function') r.then((v) => { if (typeof v === 'string') pick(v); }).catch(() => {});
          } catch (e) { console.warn('[ki-msh] ikonvelger', e); }
          return true;
        }
        case 'pptpl': u.ppTpl = d.v; ed.render(); return true;
        case 'ppcreate': {
          const t = u.ppTpl || 'fn', hass = ed.hass;
          const area = u.ppArea || ((M.areas(hass)[0] || {}).id);
          const base = t === 'rom' ? M.newPopupTemplate('rom', { area, hass }) : M.newPopupTemplate(t, {});
          base.hash = uniqueHash(ed, t === 'rom' ? '#' + String(area || 'rom').replace(/_/g, '-') : '#ny-popup');
          u.pd = newDraft(ed, base); u.pv = 'item'; ed.render(); return true;
        }
        case 'ppopen': {
          const e = entryOf(ed, d.v); if (!e) return true;
          u.pd = draftFor(ed, e); u.pv = 'item'; u.ppMenu = false; ed.render(); return true;
        }
        case 'ppback': { const r = u.pv === 'import' && u.imp && u.imp.ret; u.imp = null; if (r === 'globals') { u.pd = globalsDraft(ed); u.pv = 'globals'; ed.render(); return true; } back(ed); return true; }
        case 'ppsave': commit(ed); return true;
        case 'ppmode': {
          const p = u.pd; if (!p) return true;
          if (d.v === 'yaml' && p.src === 'auto') { const e = entryOf(ed, p.hash0); if (e && !p.dirty) { p.text = Yd(e.config || e.gen || e.base); p.v = validate(ed, p); } }
          p.mode = d.v; p.v = validate(ed, p); ed.render(); return true;
        }
        case 'ppcopy': copy(u.pd ? u.pd.text : exportText()); return true;
        case 'pppreview': preview(ed); return true;
        case 'ppreset': {
          const p = u.pd, O = { ...storeOv() }; delete O[p.hash0];
          save(ed, 'popup_overrides', Object.keys(O).length ? O : undefined);
          M.toast('Tilbakestilt til generert'); M.haptic('success');
          back(ed); return true;
        }
        case 'ppclone': {
          const p = u.pd, obj = p.v && p.v.obj; if (!obj) return true;
          const c = clone(obj); c.hash = uniqueHash(ed, obj.hash + '-kopi'); c.name = (obj.name || '') + ' (kopi)';
          u.pd = newDraft(ed, c, 'Kopi av en strategi-popup. Lagres som Egen når du trykker «Ferdig».'); u.pd.hashAuto = false; ed.render(); return true;
        }
        case 'ppdelask': u.pd.confirmDel = true; ed.render(); return true;
        case 'ppdelno': u.pd.confirmDel = false; ed.render(); return true;
        case 'ppdel': {
          const p = u.pd, L = customList().slice();
          if (p.index >= 0 && p.index < L.length) L.splice(p.index, 1);
          save(ed, 'custom_popups', L.length ? L : undefined);
          M.toast('Popup slettet');
          back(ed); return true;
        }
        case 'ppeye': {
          const e = entryOf(ed, d.v); if (!e) return true;
          if (e.hidden && e.hiddenBy === 'yaml') { M.toast('Skjult i dashbordets rå konfigurasjon'); return true; }
          if (e.hidden && e.hiddenBy === 'store') { const O = { ...storeOv() }; delete O[e.hash]; save(ed, 'popup_overrides', Object.keys(O).length ? O : undefined); return true; }
          const cur = userPops(ed)[e.key] || {};
          ed._popSet(e.key, { hidden: !cur.hidden });
          return true;
        }
        case 'ppfclr': case 'ppfcol': {
          formSet(ed, d.f, a === 'ppfclr' ? '' : d.v); return true;
        }
        default: return false;
      }
    },
    input(ed, el, kind) {
      if (ed.u.pv === 'strom' && M.powerPricePanel && M.powerPricePanel.input(ed, el, kind)) return true;
      const k = el.dataset.in, u = ed.u, d = u.pd;
      if (k === 'pparea') { if (kind === 'change') u.ppArea = el.value; return true; }
      if (k === 'ppimptext') { if (u.imp) u.imp.text = el.value; return true; }
      if (k === 'ppimpfile') {
        if (kind !== 'change') return true;
        const f = el.files && el.files[0]; if (!f) return true;
        const done = (t) => { el.value = ''; readImport(ed, String(t || ''), f.name); };
        if (f.text) f.text().then(done).catch(() => M.toast('Kunne ikke lese filen'));
        else { const r = new FileReader(); r.onload = () => done(r.result); r.onerror = () => M.toast('Kunne ikke lese filen'); r.readAsText(f); }
        return true;
      }
      if (k === 'ppicon') { if (kind === 'change') setIcon(ed, el.value); return true; }
      if (k === 'ppgap') { // 26.18
        if (kind === 'input') { const sp = el.parentNode.querySelector('.rv'); if (sp) sp.textContent = el.value + ' px'; return true; }
        if (kind === 'change') { M.haptic('selection'); gapSave(ed, el.dataset.k || null, Number(el.value)); ed.render(); }
        return true;
      }
      if (!d) return false;
      if (k === 'ppname' || k === 'pphash') {
        if (kind !== 'input' && kind !== 'change') return true;
        let v = el.value;
        if (k === 'pphash') { v = v.trim(); if (v && v[0] !== '#') v = '#' + v; d.hashAuto = false; }
        let t = setTopKey(d.text, k === 'ppname' ? 'name' : 'hash', v);
        if (k === 'ppname' && d.src === 'new' && d.hashAuto) t = setTopKey(t, 'hash', uniqueHash(ed, '#' + slugH(v)));
        const h = ed.root.querySelector('.ppcode');
        d.text = t; d.dirty = true; d.v = validate(ed, d);
        if (h && h.__set) h.__set(t);
        refreshStatus(ed);
        return true;
      }
      if (k === 'ppf') {
        if (el.type === 'range' && kind === 'input') { const s = el.parentNode.querySelector('.rv'); if (s) s.textContent = el.value; return true; }
        if (kind !== 'change') return true;
        formSet(ed, el.dataset.f, el.type === 'range' ? String(el.value) : el.value.trim());
        return true;
      }
      return false;
    },
    drop(ed, s, tg) {
      const [kind, a] = tg.drop.split(':');
      if (kind !== 'pop') return ed.render();
      const from = Number(s.id), to0 = Number(a);
      const L = customList().slice();
      if (!(from >= 0 && from < L.length) || !(to0 >= 0 && to0 < L.length) || from === to0) return ed.render();
      const [it] = L.splice(from, 1);
      let to = to0 + (tg.pos === 'b' ? 1 : 0);
      if (from < to) to--;
      L.splice(to, 0, it);
      save(ed, 'custom_popups', L);
      ed.render();
      return undefined;
    },
  };
  // Skjema → objekt → YAML-tekst
  function formSet(ed, f, v) {
    const d = ed.u.pd; if (!d || d.ro) return;
    const cur = validate(ed, d); if (cur.err || !cur.obj) return;
    const o = cur.obj;
    if (f === 'iconcol' || f === 'hdrcol') {
      const RX = f === 'iconcol' ? ICON_RX : HDR_RX, sel = f === 'iconcol' ? '.icon-container {background-color:' : '#header-container > div > div {background:';
      let st = typeof o.styles === 'string' ? o.styles : '';
      if (RX.test(st)) st = v ? st.replace(RX, `$1${v}`) : st.replace(new RegExp(RX.source + '[^}]*\\}'), '').trim();
      else if (v) st = `${st}${st && !st.endsWith('\n') ? '\n' : ''}${sel}${v}!important;}`;
      if (st) o.styles = st.endsWith('\n') ? st : st + '\n'; else delete o.styles;
    } else if (f === 'hash') { let h = String(v || '').trim(); if (h && h[0] !== '#') h = '#' + h; o.hash = h; }
    else if (v === '' || v == null) delete o[f];
    else o[f] = v;
    d.text = Yd(o); d.dirty = true; d.v = validate(ed, d);
    ed.render();
  }
})();
