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
        const st = doc.createElement('style'); st.textContent = 'html,body{overscroll-behavior:none}'; doc.head.appendChild(st);
        const fix = () => {
          doc.querySelectorAll('div').forEach((d) => { if (!d.__ki && d.children.length >= 2 && /^\s*09:41/.test(d.textContent || '') && (d.textContent || '').length < 40) { d.__ki = 1; d.style.display = 'none'; } });
          doc.querySelectorAll('button[aria-label="Lukk"]').forEach((b) => { if (b.__ki) return; b.__ki = 1; b.addEventListener('click', (e) => { const sheetOpen = b.closest('[role="dialog"]') || (b.getBoundingClientRect().top > 120); if (!sheetOpen) this.close(); }); });
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
    },
    open() {
      if (this.isOpen) return;
      this.isOpen = true;
      if (!this.f) { this.f = this._f; document.body.appendChild(this.f); }
      this.f.style.display = 'block'; this.f.style.visibility = 'visible';
      requestAnimationFrame(() => requestAnimationFrame(() => { this.f.style.transform = 'none'; }));
      try { navigator.vibrate && navigator.vibrate(8); } catch (e) {}
    },
    hide() {
      this.isOpen = false;
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
