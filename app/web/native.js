// Felles bro mot Capacitor for appens lokale sider (onboarding og demo).
// Kortene sender HA-eventet 'haptic' på window (src/00-base.js); her blir det ekte haptikk på telefonen.
(function () {
  const C = window.Capacitor;
  const P = (C && C.Plugins) || {};
  window.kiNative = { isApp: !!(C && C.isNativePlatform && C.isNativePlatform()), platform: (C && C.getPlatform && C.getPlatform()) || 'web' };

  const MAP = { light: 'LIGHT', selection: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY', success: 'SUCCESS', warning: 'WARNING', failure: 'ERROR' };
  window.kiHaptic = function (type) {
    const H = P.Haptics; if (!H) return;
    const t = MAP[type] || 'LIGHT';
    try {
      if (t === 'SUCCESS' || t === 'WARNING' || t === 'ERROR') H.notification({ type: t });
      else if (type === 'selection') H.selectionChanged ? H.selectionChanged() : H.impact({ style: t });
      else H.impact({ style: t });
    } catch (e) { /* */ }
  };
  if (window.kiNative.isApp) {
    window.addEventListener('haptic', (e) => window.kiHaptic(e.detail));
    try { P.StatusBar && P.StatusBar.setStyle({ style: 'DARK' }); } catch (e) { /* */ }
  }
})();
