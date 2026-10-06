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
    autoOn,
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
      let st = rn.querySelector(':scope > style#ki-perf-pop');
      if (!st) { st = document.createElement('style'); st.id = 'ki-perf-pop'; rn.appendChild(st); }
      const txt = P.lite ? POP + ALL : POP;
      if (st.textContent !== txt) st.textContent = txt;
      popStyles.add(st);
    },
  });

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
      st.textContent = on ? POP + ALL : POP;
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
