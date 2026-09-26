// Haptisk feedback – samme typer som Bubble Card / HA (light, medium, heavy, selection, success, warning, failure).
// Sender HA-eventet 'haptic' (companion-appen) + navigator.vibrate som fallback.
// Automatisk på knapper/lenker; overstyr med data-haptic="success" eller data-haptic="off". Slå av globalt: localStorage 'haptic' = 'off'.
(function () {
  if (window.__hapticInstalled) return;
  window.__hapticInstalled = true;
  var P = { light: 8, selection: 5, medium: 16, heavy: 30, success: [10, 60, 16], warning: [18, 80, 18], failure: [26, 50, 26, 50, 26] };
  var last = 0;
  function off() { try { return localStorage.getItem('haptic') === 'off'; } catch (e) { return false; } }
  function haptic(type) {
    type = P[type] ? type : 'light';
    if (off()) return;
    var now = Date.now(); if (now - last < 40) return; last = now;
    try { window.dispatchEvent(new CustomEvent('haptic', { detail: type, bubbles: true, composed: true })); } catch (e) {}
    try { navigator.vibrate && navigator.vibrate(P[type]); } catch (e) {}
  }
  window.haptic = haptic;
  var SEL = 'button,[role="button"],[role="switch"],[role="tab"],a[href],summary,label,[data-haptic]';
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest(SEL) : null;
    if (!t || t.disabled) return;
    var path = e.composedPath ? e.composedPath() : []; for (var i = 0; i < path.length; i++) { var n = path[i]; if (n.tagName === 'BUBBLE-CARD' && !(t.closest && t.closest('[data-haptic]'))) return; }
    var h = t.closest('[data-haptic]'), v = h ? h.getAttribute('data-haptic') : '';
    if (v === 'off') return;
    haptic(v || 'light');
  }, true);
  var steps = new WeakMap();
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t || t.type !== 'range') return;
    var v = t.value; if (steps.get(t) === v) return; steps.set(t, v);
    haptic('selection');
  }, true);
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t) return;
    if (t.type === 'checkbox' || t.type === 'radio') haptic('success');
    else if (t.type === 'range') haptic('medium');
  }, true);
})();
