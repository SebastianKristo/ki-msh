// Vær-popupen: værappen fra Nordlys OS (vaer/Vaer.dc.html, kopiert uendret) i full skjerm når #vaer åpnes.
// Rammen lastes på forhånd (skjult), så den åpner med en gang. ✕ i værappen sender kiVaerClose → lukk og fjern hashen.
(function () {
  const V = {
    init() {
      const f = document.createElement('iframe');
      f.src = 'vaer/Vaer.dc.html';
      // Værappen kjører uendret: falsk statuslinje skjules (appen har ekte), og ✕ øverst lukker popupen
      f.addEventListener('load', () => {
        let doc; try { doc = f.contentDocument; } catch (e) { return; }
        if (!doc) return;
        // Værappen er laget for en fast ramme: html/body og omslagene må ha skjermhøyde, ellers vokser roten til hele innholdet
        // (dokumentet ruller i stedet for innerlisten, ✕ og kart/steder ruller bort, detaljark åpner nederst, fx-lerretet blir 2–3 skjermer høyt)
        const st = doc.createElement('style'); st.textContent = 'html,body{height:100%;margin:0;overflow:hidden;overscroll-behavior:none}'; doc.head.appendChild(st);
        this.inset(doc);
        const fix = () => {
          const root = doc.querySelector('[style*="--vsky"]');
          if (root && !root.__ki) { root.__ki = 1; root.style.minHeight = '0'; for (let e = root; e && e !== doc.documentElement; e = e.parentElement) e.style.height = '100%'; }
          // bare selve statuslinjen («09:41» + «●●● ▮») – ikke toppfeltet rundt, som også har ✕
          doc.querySelectorAll('div').forEach((d) => { if (!d.__ki && d.children.length === 2 && (d.children[0].textContent || '').trim() === '09:41') { d.__ki = 1; d.style.display = 'none'; } });
          // hoved-✕ (data-ki-close) lukker Vær; ✕ i ark/kart lukker bare arket
          doc.querySelectorAll('button[data-ki-close]').forEach((b) => { if (b.__ki) return; b.__ki = 1; b.addEventListener('click', () => this.close()); });
        };
        fix();
        try { new MutationObserver(fix).observe(doc.body, { childList: true, subtree: true }); } catch (e) {}
      });
      f.title = 'Vær';
      f.setAttribute('allow', 'geolocation; vibrate');
      Object.assign(f.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', border: '0', zIndex: '2147482900', background: '#1b2a40', transform: 'translateY(100%)', transition: 'transform .45s cubic-bezier(.2,.85,.25,1)', visibility: 'hidden' });
      this._f = f; this.f = null;
      const chk = () => { if (location.hash === '#vaer') this.open(); else if (this.isOpen) this.hide(); };
      window.addEventListener('hashchange', chk); window.addEventListener('location-changed', chk); chk();
      window.addEventListener('message', (e) => { if (e.data && e.data.kiVaerClose) this.close(); });
      window.addEventListener('resize', () => { try { this.inset(); } catch (e) {} });
    },
    // Trygg sone fra appen (env() er 0 inni iframe på iOS) → --ki-sat/--ki-sab i værappen
    inset(doc) {
      doc = doc || (this._f && this._f.contentDocument); if (!doc) return;
      const pr = document.createElement('div'); pr.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)';
      document.body.appendChild(pr); const cs = getComputedStyle(pr); const t = cs.paddingTop, b = cs.paddingBottom; pr.remove();
      // Telefonrammen lar Vær gå opp under statuslinjen (kiBleed) → innholdet og × holdes under statuslinjen
      const bleed = this.isOpen ? (/android/.test(location.search) ? 36 : 47) : 0;
      doc.documentElement.style.setProperty('--ki-sat', bleed ? `max(${t}, ${bleed}px)` : t); doc.documentElement.style.setProperty('--ki-sab', b);
    },
    open() {
      if (this.isOpen) return;
      this.isOpen = true;
      try { window.parent.postMessage({ kiBleed: true }, '*'); } catch (e) {} // telefonrammen lar Vær gå helt opp under statuslinjen
      try { this.inset(); } catch (e) {}
      if (!this.f) { this.f = this._f; document.body.appendChild(this.f); }
      this.f.style.display = 'block'; this.f.style.visibility = 'visible';
      requestAnimationFrame(() => requestAnimationFrame(() => { this.f.style.transform = 'none'; }));
      try { navigator.vibrate && navigator.vibrate(8); } catch (e) {}
    },
    hide() {
      this.isOpen = false;
      try { window.parent.postMessage({ kiBleed: false }, '*'); } catch (e) {}
      if (!this.f) return;
      this.f.style.transform = 'translateY(100%)';
      setTimeout(() => { if (!this.isOpen) { this.f.style.visibility = 'hidden'; this.f.style.display = 'none'; } }, 470);
    },
    close() {
      this.hide();
      if (location.hash === '#vaer') { if (window.MSH && window.MSH.closePopup) window.MSH.closePopup(); else history.replaceState(null, '', location.pathname + location.search); }
    }
  };
  window.kiVaer = V;
  if (document.body) V.init(); else document.addEventListener('DOMContentLoaded', () => V.init());
})();
