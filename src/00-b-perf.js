/* KI MSH · Ytelsesmodus (MSH.perf) – lastes etter temaet og før base.
 *
 * Android (Chrome/WebView, også HA-appen) er mye tregere enn iPhone på backdrop-filter (blur) og på uendelige
 * CSS-animasjoner (hver frame tegnes på hovedtråden). Ytelsesmodus («lite») skrur av:
 *   · backdrop-filter overalt i kortene, i Tilpass-arkene og i Bubble-popupene (bg_blur → 0 via --custom-popup-filter)
 *     – glass-flater som ellers ville blitt gjennomsiktige får sin «uten blur»-reserve (samme som @supports not …)
 *   · uendelige animasjoner kjøres én runde og stopper (pulser, snurr, vugg, ping …)
 * Alt annet (farger, mål, layout) er likt. iPhone/PC: av som standard – nøyaktig samme CSS som før (reglene sendes
 * ikke engang med når modusen er av).
 *
 * Valg per enhet (localStorage 'ki-perf'): 'auto' (standard) | 'lite' (på) | 'full' (av). Auto = på for Android
 * (UA inneholder «Android») og for svake berøringsenheter (navigator.deviceMemory ≤ 2, ikke Apple). Endres i
 * Mer → Tilpass → Enheter (og #settings → Enheter): «Ytelsesmodus · Auto / På / Av».
 *
 * Mekanikk: <html data-ki-perf="lite"> + :root{--ki-perf:lite}. Reglene ligger i @container style(--ki-perf: lite)
 * (custom properties arver gjennom shadow DOM), så å slå av/på virker uten omlasting: kortene tegnes på nytt
 * (MSH.BASE_CSS får reglene), Bubble-popupene får sin <style id="ki-perf-pop"> oppdatert.
 */
(function () {
  const MSH = (window.MSH = window.MSH || {});
  if (MSH.perf) return;
  const KEY = 'ki-perf';
  const Q = '@container style(--ki-perf: lite)';
  // I alle kortenes shadow roots (via MSH.BASE_CSS) – bare når modusen er på
  const ALL = `${Q}{*,*::before,*::after{-webkit-backdrop-filter:none!important;backdrop-filter:none!important;animation-iteration-count:1!important}}`;
  // Bubble-popupens shadow root: bg_blur → 0 (Bubble setter --custom-popup-filter inline – !important vinner)
  const POP = `${Q}{.bubble-pop-up,.bubble-pop-up::before,.bubble-pop-up::after,.bubble-backdrop{--custom-popup-filter:none!important;--custom-backdrop-filter:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}}`;
  const DOC = `:root[data-ki-perf=lite]{--ki-perf:lite;--bubble-backdrop-filter:none!important}`;

  const ua = () => String((typeof navigator !== 'undefined' && navigator.userAgent) || '');
  const isAndroid = () => /Android/i.test(ua());
  /* Fiks 52 · Android (HA-appen og Chrome) – UAVHENGIG av Ytelsesmodus (som kan være slått av):
   *   klassen ki-android på <html>, dashbord-containeren (P.tag – navbaren og temaet), ki-overlay-root og hver Bubble
   *   popup-rot. Reglene sendes bare med på Android (iOS/PC får nøyaktig samme CSS som før):
   *   · Bubble-popupen: bare transform (translateY, GPU) under åpning/lukking – ingen opasitet på hele popupen (fast-open-
   *     animasjonen er byttet til ren translateY), ingen backdrop-filter mens den glir (bg_blur slår inn fast når den står
   *     stille), ::before-blurens opasitetsovergang av (blur = fast verdi, aldri animert), will-change: transform.
   *   · Bakgrunn: popupens flate har #282828-reserve (aldri gjennomsiktig/svart mens den glir inn) og <html>/<body> har
   *     dashbordets #232323 bak alt – ingen hvit/svart blink når et lag tegnes sent.
   *   Navbar/«Mer»/mini-spiller/ark: se ANDROID_CSS i 10-navbar.js og MSH.overlay (blur statisk, bare indre lag animeres). */
  const ANDROID = isAndroid();
  const AND_POP = `.bubble-pop-up:not(.editor){transition-property:transform!important}
.bubble-pop-up.is-opening:not(.editor),.bubble-pop-up.is-closing:not(.editor){-webkit-backdrop-filter:none!important;backdrop-filter:none!important;will-change:transform}
.bubble-pop-up:not(.editor)::before{transition:none!important;will-change:auto!important}
.bubble-pop-up:not(.editor) .bubble-header-container,.bubble-pop-up:not(.editor) .bubble-header-container *{transition:none!important}
.bubble-pop-up.is-opening:not(.editor)::before,.bubble-pop-up.is-closing:not(.editor)::before{opacity:0!important}
.bubble-pop-up.is-fast-opening:not(.editor):not(.popup-mode-centered):not(.popup-mode-adaptive-dialog){animation-name:ki-and-pop-in!important}
@keyframes ki-and-pop-in{from{transform:translateY(14px)}to{transform:translateY(0)}}
.bubble-pop-up-background{background-color:var(--bubble-pop-up-main-background-color,var(--bubble-pop-up-background-color,color-mix(in srgb,var(--ki-popup,#282828) var(--ki-pop-op,98%),transparent)))}`;
  /* Fiks 55 A4 · «Blur i popups på Android» (Tilpass Hjem → Popups, ki-store popup_android_blur, standard av): av → popupens
   * bg_blur er 0 hele tiden på Android (fast bg_opacity uten blur – ingen blur som slår inn når glidingen stopper); på → som
   * Fiks 52: 0 under åpning/lukking (AND_POP), konfigurert verdi når popupen står stille. */
  const AND_NOBLUR = `.bubble-pop-up:not(.editor),.bubble-pop-up:not(.editor)::before,.bubble-pop-up:not(.editor)::after{--custom-popup-filter:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}`;
  const AND_DOC = `html.ki-android,html.ki-android>body{background-color:var(--ki-bg,#232323)}:root.ki-android{--ki-android:1}`;
  const isApple = () => /iPhone|iPad|iPod|Macintosh/i.test(ua());
  const lowEnd = () => {
    try { const m = navigator.deviceMemory, t = navigator.maxTouchPoints || 0; return !isApple() && typeof m === 'number' && m > 0 && m <= 2 && t > 0; } catch (e) { return false; }
  };
  const pref = () => { try { const v = localStorage.getItem(KEY); return v === 'lite' || v === 'full' ? v : 'auto'; } catch (e) { return 'auto'; } };
  const autoOn = () => isAndroid() || lowEnd();

  const popStyles = new Set();
  const P = (MSH.perf = {
    KEY,
    lite: false,
    CSS: '',
    POP_CSS: POP,
    isAndroid,
    android: ANDROID,
    AND_POP,
    autoOn,
    // Fiks 52: klassen ki-android på et element (dashbord-container, overlay-rot …) – bare på Android
    tag(el) { if (ANDROID && el && el.classList && !el.classList.contains('ki-android')) el.classList.add('ki-android'); return el; },
    pref,
    // 'auto' | 'lite' | 'full'
    set(v) {
      try { if (v === 'lite' || v === 'full') localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch (e) { /* */ }
      apply();
    },
    // Kort tekst til innstillingene: «På (Android)» / «Av»
    label() {
      const p = pref();
      if (p === 'lite') return 'På';
      if (p === 'full') return 'Av';
      return P.lite ? (isAndroid() ? 'Auto · på (Android)' : 'Auto · på (svak enhet)') : 'Auto · av';
    },
    // Bubble popup-rot (kalles fra MSH.theme.adoptPopup): attributt + stil i popupens shadow root
    adoptPop(pop) {
      if (!pop || !pop.setAttribute) return;
      if (P.lite) pop.setAttribute('data-ki-perf', 'lite'); else pop.removeAttribute('data-ki-perf');
      const rn = pop.getRootNode && pop.getRootNode();
      if (!rn || rn === document || !rn.querySelector) return;
      let st = rn.getElementById ? rn.getElementById('ki-perf-pop') : null; // Fiks 52: ikke «:scope >» (virker ikke i ShadowRoot)
      if (!st) { st = document.createElement('style'); st.id = 'ki-perf-pop'; rn.appendChild(st); }
      const txt = popTxt(P.lite);
      if (st.textContent !== txt) st.textContent = txt;
      popStyles.add(st);
      if (ANDROID) { P.tag(pop); fixPopBg(pop); watchStore(); knowPop(pop); }
    },
  });

  const androidBlur = () => { try { return !!(MSH.store && MSH.store.get && MSH.store.get('popup_android_blur') === true); } catch (e) { return false; } };
  // «På» vinner over Ytelsesmodus Auto (som ellers tar all blur på Android), men ikke over Ytelsesmodus «På» (lite valgt)
  const popTxt = (lite) => {
    if (!ANDROID) return lite ? POP + ALL : POP;
    if (androidBlur()) return (lite && pref() === 'lite' ? POP + ALL : '') + AND_POP;
    return (lite ? POP + ALL : POP) + AND_POP + AND_NOBLUR;
  };
  P.androidBlur = androidBlur;
  // Valget endret (ki-store, også fra en annen enhet) → stilen i alle popup-røtter oppdateres uten omlasting
  let storeOff = null;
  function watchStore() {
    if (storeOff || !ANDROID || !MSH.store || !MSH.store.subscribe) return;
    storeOff = MSH.store.subscribe((d, path) => { if (!path || path === 'popup_android_blur') refreshPops(); });
  }
  function refreshPops() {
    const txt = popTxt(P.lite);
    for (const st of [...popStyles]) { if (!st.isConnected) { popStyles.delete(st); continue; } if (st.textContent !== txt) st.textContent = txt; }
  }
  P.refreshPops = refreshPops;
  // Android: Bubble regner ut popupens flate fra --ha-card-background/--card-background-color én gang (første åpning).
  // Mangler temaet da (kald start i appen), blir flaten rgba(0,0,0,op) – svart blink/svart popup. Uten eget bg_color i
  // popupens config → popup-nivået #282828 (--ki-popup) med samme opasitet.
  function fixPopBg(pop) {
    const v = pop.style.getPropertyValue('--bubble-pop-up-background-color').trim();
    if (!/^rgba\(0, 0, 0, /.test(v)) return;
    const host = pop.getRootNode && pop.getRootNode().host, cfg = host && (host.config || host._config);
    if (cfg && cfg.bg_color) return;
    const op = Math.max(0, Math.min(1, parseFloat(v.slice(14)) || 0.98));
    pop.style.setProperty('--bubble-pop-up-background-color', `color-mix(in srgb, var(--ki-popup, #282828) ${Math.round(op * 100)}%, transparent)`);
    pop.style.setProperty('--bubble-pop-up-fade-color', `color-mix(in srgb, var(--ki-popup, #282828) ${Math.round(op * 65)}%, transparent)`);
  }
  /* Fiks 55 A4 · Android: bakgrunnsdimmingen og glidingen starter i SAMME bilde. Bubble viser bakteppet (.bubble-backdrop,
   * eget lag på document.body) før kortene i popupen er bygget, og starter glidingen (is-opening) først 1–3 bilder senere –
   * opptaket viste dimmet dashbord før popupen beveget seg. Bakteppet holdes derfor på opasitet 0 (klassen ki-hold, uten
   * overgang) fra det blir synlig til popupen for hashen får is-opening; da fjernes klassen i samme mikrooppgave (samme
   * bilde) og bakteppet toner inn med Bubbles egen overgang mens popupen glir. Vern: slippes etter 800 ms uansett. */
  const popByHash = new Map();
  function knowPop(pop) {
    const host = pop.getRootNode && pop.getRootNode().host, cfg = host && (host.config || host._config), h = cfg && cfg.hash;
    if (h) popByHash.set(String(h).startsWith('#') ? String(h) : '#' + h, pop);
  }
  function findPop(hash) {
    const k = popByHash.get(hash);
    if (k && k.isConnected) return k;
    let hit = null;
    const walk = (r, d) => { if (hit || !r || d > 14) return; const L = r.querySelectorAll('*'); for (const e of L) { if (hit) return; if (e.classList && e.classList.contains('bubble-pop-up')) { knowPop(e); if (popByHash.get(hash) === e) { hit = e; return; } } if (e.shadowRoot) walk(e.shadowRoot, d + 1); } };
    walk(document, 0);
    return hit;
  }
  const opening = (pop) => pop.classList.contains('is-opening') || (pop.classList.contains('is-popup-opened') && !pop.classList.contains('is-popup-closed') && !pop.style.transform);
  let hold = null;
  function release() {
    if (!hold) return;
    const H = hold; hold = null;
    clearTimeout(H.cap); cancelAnimationFrame(H.raf); if (H.mo) H.mo.disconnect();
    H.bd.classList.remove('ki-hold');
  }
  function holdBackdrop(bd) {
    release();
    const H = (hold = { bd, mo: null, cap: 0, raf: 0, pop: null });
    const attach = (pop) => {
      if (H.pop || !pop) return;
      H.pop = pop;
      if (pop.classList.contains('is-opening')) return release();
      H.mo = new MutationObserver(() => { if (hold === H && pop.classList.contains('is-opening')) release(); });
      H.mo.observe(pop, { attributes: true, attributeFilter: ['class'] });
    };
    bd.classList.add('ki-hold');
    attach(findPop(location.hash));
    // Popup-elementet kan bli satt inn etter bakteppet (første åpning) – let videre én gang per bilde til det finnes
    const tick = () => { if (hold !== H) return; if (!H.pop) attach(popByHash.get(location.hash) && popByHash.get(location.hash).isConnected ? popByHash.get(location.hash) : null); else if (opening(H.pop)) return release(); H.raf = requestAnimationFrame(tick); };
    H.raf = requestAnimationFrame(tick);
    H.cap = setTimeout(release, 800);
    P.backdropHolds = (P.backdropHolds || 0) + 1;
  }
  function armBackdrop(host) {
    const sr = host && host.shadowRoot, bd = sr && sr.querySelector('.bubble-backdrop');
    if (!bd || bd.__kiHold) return;
    bd.__kiHold = true;
    if (!sr.getElementById('ki-and-bd')) { const st = document.createElement('style'); st.id = 'ki-and-bd'; st.textContent = '.bubble-backdrop.ki-hold{opacity:0!important;transition:none!important}'; sr.appendChild(st); }
    let was = false;
    const chk = () => { const v = bd.classList.contains('is-visible'); if (v && !was && location.hash) holdBackdrop(bd); else if (!v && hold && hold.bd === bd) release(); was = v; };
    new MutationObserver(chk).observe(bd, { attributes: true, attributeFilter: ['class'] });
    chk();
  }
  function watchBackdrop() {
    const cur = document.querySelector('body > .bubble-backdrop-host');
    if (cur) armBackdrop(cur);
    if (!document.body) return;
    new MutationObserver((L) => { for (const r of L) r.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.classList && n.classList.contains('bubble-backdrop-host')) armBackdrop(n); }); }).observe(document.body, { childList: true });
  }
  P.release = release;
  if (ANDROID) {
    if (document.body) watchBackdrop(); else document.addEventListener('DOMContentLoaded', watchBackdrop, { once: true });
    const html = document.documentElement;
    html.classList.add('ki-android');
    const st = document.createElement('style');
    st.id = 'msh-android';
    st.textContent = AND_DOC;
    (document.head || html).appendChild(st);
  }

  let docSt = null;
  function apply() {
    const on = pref() === 'lite' || (pref() === 'auto' && autoOn());
    const changed = on !== P.lite;
    P.lite = on;
    P.CSS = on ? ALL : '';
    const html = document.documentElement;
    if (on) html.setAttribute('data-ki-perf', 'lite'); else html.removeAttribute('data-ki-perf');
    if (on && !docSt) {
      docSt = document.createElement('style');
      docSt.id = 'msh-perf';
      docSt.textContent = DOC;
      (document.head || html).appendChild(docSt);
    }
    if (!changed) return;
    for (const st of [...popStyles]) {
      if (!st.isConnected) { popStyles.delete(st); continue; }
      st.textContent = popTxt(on);
      const pop = st.parentNode && st.parentNode.querySelector && st.parentNode.querySelector('.bubble-pop-up');
      if (pop) { if (on) pop.setAttribute('data-ki-perf', 'lite'); else pop.removeAttribute('data-ki-perf'); }
    }
    // Kortene tar med P.CSS i sin <style> (MSH.BASE_CSS) – tegn de levende kortene på nytt
    try { if (MSH.liveCards) MSH.liveCards.forEach((set) => set.forEach((c) => { if (c && c.update) c.update(); })); } catch (e) { /* */ }
    try { window.dispatchEvent(new CustomEvent('ki-perf-change', { detail: { lite: on } })); } catch (e) { /* */ }
  }
  P.apply = apply;
  apply();
  // Endret i en annen fane på samme enhet
  window.addEventListener('storage', (e) => { if (e.key === KEY) apply(); });
})();
