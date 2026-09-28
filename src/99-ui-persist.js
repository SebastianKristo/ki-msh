/* KI MSH · UI-tilstand som skal overleve en rebuild (lagres i localStorage ki:<card_id>:ui, aldri i Lovelace).
 * Kort som selv definerer static uiPersist (Kamera, Media) står urørt. */
(function () {
  const KEYS = {
    'msh-hjem-faner-card': ['tab'], // Fiks 20.19: karusell-/stabel-posisjonen (sw) lagres IKKE – starter på første kort ved innlasting
    // msh-rom-card: ingen – seksjonene starter fra «Åpen ved start» (config) ved hver åpning (Fiks 7)
    'msh-klima-card': ['tab', 'zone', 'water'],
    'msh-lys-card': ['tab', 'fold'],
    'msh-basseng-card': ['tab'],
    'msh-vanning-card': ['tab', 'period'],
    'msh-vaer-card': ['dayOpen'],
    'msh-vaer-hero-card': ['hero'],
    'msh-gjoremal-card': ['tab', 'filter'],
  };
  Object.keys(KEYS).forEach((tag) => {
    const cls = customElements.get(tag);
    if (!cls || Object.prototype.hasOwnProperty.call(cls, 'uiPersist')) return;
    Object.defineProperty(cls, 'uiPersist', { get: () => KEYS[tag], configurable: true });
  });
})();
