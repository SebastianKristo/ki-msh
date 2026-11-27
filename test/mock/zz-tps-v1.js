// Fiks 26.2: Tilpass-senteret erstatter Mer → Tilpass-arket, «Tilpass alt»-listen, kiosk-arket og navbar-/header-editorene.
// Testene for de gamle arkene (som fortsatt finnes som …V1) kaller window.__useTilpassV1() for å teste dem direkte.
window.__useTilpassV1 = function () {
  const M = window.MSH; if (!M) return;
  if (M.openDashEditorV1) M.openDashEditor = M.openDashEditorV1;
  if (M.kioskSheetV1) M.kioskSheet = M.kioskSheetV1;
  if (M.openTilpassAltV1) M.openTilpassAlt = M.openTilpassAltV1;
  if (M.openOnboardingV1) M.openOnboarding = M.openOnboardingV1;
  const NB = customElements.get('msh-navbar-card');
  if (NB && NB.prototype._tilpassSheetV1) NB.prototype._tilpassSheet = NB.prototype._tilpassSheetV1;
};
