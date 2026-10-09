/* KI MSH · språk (norsk bokmål / engelsk) – Fiks 59. Lastes først i bundelen (før tema og base).
 * Norsk er kildespråket: malene skrives på norsk som før. Når språket er engelsk oversettes tekstnoder og attributtene
 * placeholder, title og aria-label i alle KI-shadow-roots etter hvert som kortene tegner (MutationObserver per rot).
 * Bytte tilbake til norsk gjenoppretter originalteksten uten omlasting.
 *
 * API (også på window, som i designet):
 *   kiLang()                → 'no' | 'en'
 *   kiSetLang('en' | 'no')  → bytter, lagrer (localStorage 'ki-lang' + ki-store 'lang' per HA-bruker), sender 'ki-lang'
 *   kiT('Norsk', 'English') → riktig tekst for språket; kiT('Norsk') slår opp i ordboken
 *   MSH.i18n = { lang, set, t, tr(text), add(dict), observe(root), refresh(), missing, locale() }
 * Standard (ingen valg): HA-brukerens språk (hass.language: nb/nn/no → norsk, ellers engelsk).
 * Ordbok: { 'Norsk': 'English' }, § = variabel verdi (tall, tid, navn …): '§ lys på': '§ lights on'. Variabelen oversettes
 *   også hvis den finnes i ordboken. Oppslag tåler stor/liten forbokstav, ledende ikon/emoji, avsluttende tegnsetting og
 *   sammensatte tekster delt med ' · ', ' – ', ' / ' og ', '. Ukedager, måneder, «i dag», «i morgen», «i går» og «kl.»
 *   oversettes i datoer. Ordbøkene ligger i src/00-a-i18n-en*.js (M.i18n.add).
 * Oversettes ikke: [data-noi18n] (og alt under), script, style, textarea, pre, code, contenteditable og input-verdier.
 * Hvilke røtter: shadow roots på msh-… og ki-… og vanlige elementer (div/span …) som KI lager (overlegg, portaler, toasts) –
 *   aldri HA-/tredjepartselementer (navn med bindestrek som ikke er msh-/ki-).
 * Manglende nøkler (engelsk) samles i MSH.i18n.missing (Set) og logges i dev-modus (localStorage 'ki-i18n-dev' = '1').
 */
(function () {
  const W = window;
  if (W.MSH && W.MSH.i18n) return;
  const M = (W.MSH = W.MSH || {});
  const LS = 'ki-lang';
  const D = Object.create(null); // norsk → engelsk
  const LC = Object.create(null); // små bokstaver → nøkkel
  const missing = new Set();
  let lang = null, auto = 'no', ver = 0;
  const dev = (() => { try { return localStorage.getItem('ki-i18n-dev') === '1'; } catch (e) { return false; } })();

  const norm = (v) => (v === 'en' ? 'en' : v === 'no' || v === 'nb' || v === 'nn' ? 'no' : null);
  const stored = () => { try { return norm(localStorage.getItem(LS)); } catch (e) { return null; } };
  const cur = () => lang || stored() || auto;

  function add(dict) {
    if (!dict) return;
    Object.keys(dict).forEach((k) => { const v = dict[k]; if (typeof v !== 'string') return; D[k] = v; LC[k.toLowerCase()] = k; });
    ver++;
    if (cur() === 'en') refresh();
  }

  /* ------------------------------------------------------------ oppslag */
  const NUM = /[−-]?\d+(?:[  ]\d{3})*(?:[.,:]\d+)*/g;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const isCap = (s) => s.charAt(0) !== s.charAt(0).toLowerCase();
  // Datoord (ukedager, måneder, relative dager) – brukes når teksten ser ut som en dato/tid
  const DW = {
    mandag: 'Monday', tirsdag: 'Tuesday', onsdag: 'Wednesday', torsdag: 'Thursday', fredag: 'Friday', lørdag: 'Saturday', søndag: 'Sunday',
    man: 'Mon', tir: 'Tue', ons: 'Wed', tor: 'Thu', fre: 'Fri', lør: 'Sat', søn: 'Sun',
    januar: 'January', februar: 'February', mars: 'March', april: 'April', mai: 'May', juni: 'June', juli: 'July', august: 'August', september: 'September', oktober: 'October', november: 'November', desember: 'December',
    jan: 'Jan', feb: 'Feb', mar: 'Mar', apr: 'Apr', jun: 'Jun', jul: 'Jul', aug: 'Aug', sep: 'Sep', sept: 'Sep', okt: 'Oct', nov: 'Nov', des: 'Dec',
    'i dag': 'today', 'i morgen': 'tomorrow', 'i går': 'yesterday', 'i overmorgen': 'the day after tomorrow', 'kl.': 'at', kl: 'at',
  };
  const DW_RX = new RegExp('(^|[^\\p{L}])(' + Object.keys(DW).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.]/g, '\\.')).join('|') + ')(?=$|[^\\p{L}])', 'giu');
  const DATEISH = /(\d|mandag|tirsdag|onsdag|torsdag|fredag|lørdag|søndag|januar|februar|mars|april|juni|juli|august|september|oktober|november|desember|i dag|i morgen|i går)/i;
  function dateWords(s) {
    if (!DATEISH.test(s)) return null;
    let hit = false;
    const out = s.replace(DW_RX, (m, pre, w) => { const k = w.toLowerCase(), v = DW[k]; if (!v) return m; hit = true; return pre + (isCap(w) && !isCap(v) ? cap(v) : v); });
    return hit ? out : null;
  }
  // Direkte oppslag med stor/liten forbokstav
  function direct(s) {
    if (s in D) return D[s];
    const k = LC[s.toLowerCase()];
    if (k) { const v = D[k]; return isCap(s) && !isCap(v) ? cap(v) : !isCap(s) && isCap(v) && !isCap(k) ? v : !isCap(s) && isCap(v) ? v.charAt(0).toLowerCase() + v.slice(1) : v; }
    return null;
  }
  // § = tall/tid/verdi: '12 lys på' → '§ lys på'
  function withVars(s) {
    const vals = [];
    const key = s.replace(NUM, (m) => { vals.push(m); return '§'; });
    if (!vals.length) return null;
    const v = direct(key);
    if (v == null) return null;
    let i = 0;
    return v.replace(/§/g, () => (i < vals.length ? vals[i++] : '§'));
  }
  // [skilletegn, engelsk skilletegn] – « og » deler bare når begge delene kan oversettes
  const SPLIT = [[' · '], [' – '], [' — '], [' / '], [', '], [': '], [' og ', ' and ', true]];
  const LEAD = /^([^\p{L}\p{N}«(]+)/u; // ikon/emoji/tegn foran
  const TRAIL = /(\s*[.:!?…»)›↗]+)$/;
  function core(s, depth) {
    let v = direct(s);
    if (v != null) return v;
    v = withVars(s);
    if (v != null) return v;
    // ledende symbol / avsluttende tegnsetting
    const lm = LEAD.exec(s);
    if (lm && lm[1].length < s.length) { const r = core(s.slice(lm[1].length), depth); if (r != null) return lm[1] + r; }
    const tm = TRAIL.exec(s);
    if (tm && tm[1].length < s.length) { const r = core(s.slice(0, -tm[1].length), depth); if (r != null) return r + tm[1]; }
    // sammensatt: del og oversett delene
    if (depth < 3) {
      for (const [sep, en, all] of SPLIT) {
        if (s.indexOf(sep) < 0) continue;
        const parts = s.split(sep);
        let any = false, every = true;
        const out = parts.map((p) => { const r = p.trim() ? core(p, depth + 1) : null; if (r != null) { any = true; return r; } if (LETTERS.test(p)) every = false; return p; });
        if (all ? any && every : any) return out.join(en || sep);
      }
      // § som navn/ord: prøv å bytte ett ord om gangen med § (f.eks. «Varmer · 22°» eller «Hei, Sebastian»)
      const words = s.split(' ');
      if (words.length > 1 && words.length <= 8) {
        for (let i = 0; i < words.length; i++) {
          const k = words.slice(0, i).concat('§', words.slice(i + 1)).join(' ');
          const t = direct(k);
          if (t != null) { const w = core(words[i], depth + 1); return t.replace('§', w != null ? w : words[i]); }
        }
        // § som flere ord i slutten/starten («Senk KI Vindu Forsinkelse» → «Senk §», «§ trenger vann»)
        for (let i = 1; i < words.length; i++) {
          const head = words.slice(0, i).join(' '), tail = words.slice(i).join(' ');
          // bakre fast del må være minst 4 bokstaver («§ til» / «§ av» gjelder bare tall)
          let t = direct(head + ' §');
          if (t != null) { const v = core(tail, depth + 1); return t.replace('§', v != null ? v : tail); }
          t = tail.length >= 4 ? direct('§ ' + tail) : null;
          if (t != null) { const v = core(head, depth + 1); return t.replace('§', v != null ? v : head); }
        }
      }
    }
    const dw = dateWords(s);
    if (dw != null) return dw;
    return null;
  }
  const LETTERS = /\p{L}{2,}/u;
  const SKIP_TXT = /^([a-z_]+\.[a-z0-9_]+|[#/][\w/-]*|https?:\/\/\S+|mdi:[\w-]+)$/i; // entitets-ID, hash/sti, URL, ikon
  // Oversett én tekst (beholder mellomrom foran/bak). null = ingen oversettelse.
  function tr(text) {
    if (text == null) return null;
    const s = String(text), m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s), body = m[2];
    if (!body || !LETTERS.test(body) || SKIP_TXT.test(body)) return null;
    const r = core(body, 0);
    if (r == null) { if (missing.size < 5000 && !missing.has(body)) { missing.add(body); if (dev) console.info('[ki-i18n] mangler:', JSON.stringify(body)); } return null; }
    return m[1] + r + m[3];
  }
  // kiT('Norsk', 'English') · kiT('Norsk') → ordboken
  function t(no, en) {
    if (cur() !== 'en') return no;
    if (en != null) return en;
    const r = tr(no);
    return r == null ? no : r;
  }

  /* ------------------------------------------------------------ DOM-oversetting */
  const ORIG = new WeakMap(); // tekstnode → { o: original, t: oversatt }
  const AORIG = new WeakMap(); // element → { attr: { o, t } }
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const SKIP_TAG = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'PRE', 'CODE', 'TEMPLATE', 'svg', 'SVG']);
  const skipEl = (el) => { for (let n = el; n && n.nodeType === 1; n = n.parentNode) { if (SKIP_TAG.has(n.tagName) || n.hasAttribute('data-noi18n') || n.isContentEditable) return true; } return false; };
  function doText(node, en) {
    const rec = ORIG.get(node), val = node.nodeValue;
    if (!en) { if (rec && val === rec.t) node.nodeValue = rec.o; ORIG.delete(node); return; }
    if (rec && val === rec.t) return; // allerede oversatt
    const p = node.parentNode;
    if (!p || p.nodeType !== 1 || skipEl(p)) return;
    const r = tr(val);
    if (r != null && r !== val) { ORIG.set(node, { o: val, t: r }); node.nodeValue = r; } else ORIG.delete(node);
  }
  function doAttrs(el, en) {
    let rec = AORIG.get(el);
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      const v = el.getAttribute(a), r0 = rec && rec[a];
      if (!en) { if (r0 && v === r0.t) el.setAttribute(a, r0.o); continue; }
      if (r0 && v === r0.t) continue;
      if (skipEl(el)) return;
      const r = tr(v);
      if (r != null && r !== v) { if (!rec) { rec = {}; AORIG.set(el, rec); } rec[a] = { o: v, t: r }; el.setAttribute(a, r); }
    }
    if (!en) AORIG.delete(el);
  }
  function walk(root, en) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root, en); return; }
    if (root.nodeType === 1) { if (SKIP_TAG.has(root.tagName) || root.hasAttribute('data-noi18n')) return; doAttrs(root, en); }
    const tw = document.createTreeWalker(root, 5 /* SHOW_ELEMENT | SHOW_TEXT */, {
      acceptNode: (n) => (n.nodeType === 1 && (SKIP_TAG.has(n.tagName) || n.hasAttribute('data-noi18n')) ? 2 /* REJECT */ : 1),
    });
    let n = tw.nextNode();
    while (n) { if (n.nodeType === 3) doText(n, en); else doAttrs(n, en); n = tw.nextNode(); }
  }
  const ROOTS = new Set(); // WeakRef til observerte røtter
  let busy = false;
  function onMut(list) {
    if (busy || cur() !== 'en') return;
    busy = true;
    try {
      for (const m of list) {
        if (m.type === 'characterData') doText(m.target, true);
        else if (m.type === 'attributes') { if (m.target.nodeType === 1) doAttrs(m.target, true); }
        else m.addedNodes.forEach((n) => walk(n, true));
      }
    } finally { busy = false; }
  }
  function observe(root) {
    if (!root || root.__kiI18n) return;
    root.__kiI18n = true;
    const mo = new MutationObserver(onMut);
    mo.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    ROOTS.add(typeof WeakRef === 'function' ? new WeakRef(root) : { deref: () => root });
    if (cur() === 'en') { busy = true; try { walk(root, true); } finally { busy = false; } }
  }
  function refresh() {
    const en = cur() === 'en';
    busy = true;
    try { ROOTS.forEach((r) => { const x = r.deref(); if (!x) { ROOTS.delete(r); return; } walk(x, en); }); } finally { busy = false; }
  }
  // Alle KI-shadow-roots observeres: msh-…/ki-… og vanlige elementer (div …); aldri HA-/tredjepartselementer
  const ours = (host) => { const n = host.localName || ''; return n.indexOf('-') < 0 || n.startsWith('msh-') || n.startsWith('ki-'); };
  const orig = Element.prototype.attachShadow;
  if (orig && !orig.__ki) {
    const patched = function (init) { const sr = orig.call(this, init); try { if (ours(this)) observe(sr); } catch (e) { /* */ } return sr; };
    patched.__ki = true;
    Element.prototype.attachShadow = patched;
  }

  /* ------------------------------------------------------------ språkvalg */
  function apply(fromStorage) {
    const l = cur();
    try { document.documentElement.setAttribute('lang', l === 'en' ? 'en' : 'nb'); } catch (e) { /* */ }
    refresh();
    try { W.dispatchEvent(new CustomEvent('ki-lang', { detail: { lang: l, fromStorage: !!fromStorage } })); } catch (e) { /* */ }
  }
  function set(l) {
    l = norm(l) || 'no';
    const was = cur();
    lang = l;
    try { localStorage.setItem(LS, l); } catch (e) { /* */ }
    try { if (M.store && M.store.set) M.store.set('lang', l); } catch (e) { /* */ } // per HA-bruker (synkes mellom enhetene)
    if (l !== was) apply();
    return l;
  }
  // HA-brukerens språk som standard (kalles fra basekortets hass-setter) + valget fra ki-store (andre enheter)
  let subbed = false;
  function fromHass(hass) {
    if (!hass) return;
    // Valg gjort på en annen enhet (ki-store 'lang', per HA-bruker) slår gjennom her også
    if (!subbed && M.store && M.store.subscribe) {
      subbed = true;
      M.store.subscribe((d) => { const s = norm(d && d.lang); if (s && s !== cur()) { lang = s; try { localStorage.setItem(LS, s); } catch (e) { /* */ } apply(); } });
    }
    const a = norm(String(hass.language || (hass.locale && hass.locale.language) || '').slice(0, 2)) || (hass.language ? 'en' : null);
    const s = M.store && M.store.get ? norm(M.store.get('lang')) : null;
    const was = cur();
    if (a) auto = a;
    if (s && !lang && !stored()) lang = s;
    if (cur() !== was) apply();
  }
  W.addEventListener('storage', (e) => { if (e.key === LS) { lang = norm(e.newValue); apply(true); } });

  // Intl-locale for datoer/tall fra HA
  const locale = () => (cur() === 'en' ? 'en-GB' : 'nb-NO');

  // Felles rad «Språk · Language» (Tilpass Hjem, Tilpass alt …): språknavnene alltid på eget språk (data-noi18n)
  const rowHTML = (attrs) => `<button class="press ki-lrow" ${attrs || 'data-a="kilang"'} data-noi18n aria-label="Språk · Language" style="display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:8px 14px 8px 8px;border-radius:24px;border:0;background:var(--ki-sheet-grp,var(--ki-surface, #3a3a3a));color:var(--ki-text, #fafafa);font:inherit;text-align:left;cursor:pointer"><span style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none;background:var(--ki-surface-2, #4a4a4a);font-size:13px;font-weight:700">${cur() === 'en' ? 'EN' : 'NO'}</span><span style="display:flex;flex-direction:column;flex:1;min-width:0"><b style="font-size:15px;font-weight:600">Språk · Language</b><i style="font-style:normal;font-size:12px;color:var(--ki-text-2, #afafaf)">${cur() === 'en' ? 'English' : 'Norsk'}</i></span><span style="font-size:13px;font-weight:600;color:var(--ki-text-2, #afafaf)">${cur() === 'en' ? 'Norsk ›' : 'English ›'}</span></button>`;
  const toggle = () => set(cur() === 'en' ? 'no' : 'en');

  M.i18n = { rowHTML, toggle, lang: cur, set, t, tr, add, observe, refresh, fromHass, missing, locale, dict: D, get ver() { return ver; } };
  W.kiLang = cur;
  W.kiSetLang = set;
  W.kiT = t;
  try { document.documentElement.setAttribute('lang', cur() === 'en' ? 'en' : 'nb'); } catch (e) { /* */ }
})();
