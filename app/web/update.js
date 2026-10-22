// Oppdater Android-appen fra appen: GitHub Actions legger nyeste APK + latest.json på grenen
// «android-oppdatering». Er versionCode der høyere enn appens egen, vises et ark med «Oppdater nå».
(function () {
  const FEED = 'https://raw.githubusercontent.com/SebastianKristo/ki-msh/android-oppdatering/latest.json';
  const C = window.Capacitor;
  const U = C && C.Plugins && C.Plugins.ApkUpdater;
  const android = !!(window.kiNative && window.kiNative.platform === 'android' && U);
  const hap = (t) => window.kiHaptic && window.kiHaptic(t);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let mine = null, latest = null;

  async function info() {
    if (!android) return null;
    if (!mine) { try { mine = await U.info(); } catch (e) { mine = null; } }
    return mine;
  }

  async function fetchLatest() {
    const r = await fetch(FEED + '?t=' + Date.now(), { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  // Gir oppdateringsinfo hvis det finnes en nyere versjon (og viser arket), ellers null.
  async function check(timeoutMs, opts) {
    opts = opts || {};
    if (!android) return null;
    try {
      const [me, l] = await Promise.race([
        Promise.all([info(), fetchLatest()]),
        new Promise((_, no) => setTimeout(() => no(new Error('timeout')), timeoutMs || 4000)),
      ]);
      latest = l;
      if (me && l && Number(l.versionCode) > Number(me.versionCode)) { sheet(me, l); return l; }
      if (opts.manual) toast('Du har nyeste versjon (' + esc(me ? me.versionName : '') + ')');
    } catch (e) { if (opts.manual) toast('Fant ikke oppdateringer: ' + esc(e.message)); }
    return null;
  }

  function toast(html) {
    let t = document.getElementById('ki-up-toast');
    if (!t) { t = document.createElement('div'); t.id = 'ki-up-toast'; t.style.cssText = 'position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 24px);transform:translateX(-50%);max-width:88%;padding:12px 18px;border-radius:24px;background:#fafafa;color:#232323;font:500 14px "Space Grotesk",system-ui,sans-serif;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.35);transition:opacity .3s'; document.body.appendChild(t); }
    t.innerHTML = html; t.style.opacity = 1; clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = 0; }, 2600);
  }

  function sheet(me, l) {
    let s = document.getElementById('ki-up');
    if (s) s.remove();
    s = document.createElement('div'); s.id = 'ki-up';
    s.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.45);display:flex;align-items:flex-end';
    s.innerHTML = '<div style="width:100%;background:#282828;border-radius:32px 32px 0 0;padding:24px 20px calc(env(safe-area-inset-bottom) + 20px);display:flex;flex-direction:column;gap:10px;animation:ob-in .3s both">' +
      '<div style="display:flex;align-items:center;gap:14px"><span style="width:56px;height:56px;flex:none;border-radius:50%;background:#2f2f2f;display:flex;align-items:center;justify-content:center;font-size:28px;color:#f285c9"><i class="mdi mdi-download"></i></span>' +
      '<span style="display:flex;flex-direction:column;gap:3px"><b style="font-size:20px;font-weight:500">Ny versjon av appen</b><small style="font-size:13px;color:#979797">' + esc(me.versionName) + ' → ' + esc(l.versionName) + '</small></span></div>' +
      (l.notes ? '<div style="font-size:14px;color:#afafaf;line-height:1.45;padding:4px 2px;white-space:pre-line;max-height:30vh;overflow:auto">' + esc(l.notes) + '</div>' : '') +
      '<div id="ki-up-err" style="font-size:13px;color:#f28073;padding:0 4px"></div>' +
      '<button id="ki-up-go" class="primary">Oppdater nå</button>' +
      '<button id="ki-up-later" class="ghost">Senere</button></div>';
    document.body.appendChild(s);
    const go = s.querySelector('#ki-up-go'), err = s.querySelector('#ki-up-err');
    s.querySelector('#ki-up-later').onclick = () => { hap('light'); s.remove(); document.dispatchEvent(new Event('ki-update-later')); };
    go.onclick = async () => {
      hap('light'); err.textContent = '';
      try {
        const ok = await U.canInstall();
        if (!ok.allowed) {
          err.textContent = 'Tillat «Installer ukjente apper» for KI MSH, og trykk Oppdater nå igjen.';
          await U.openInstallSettings();
          return;
        }
        go.disabled = true; go.textContent = 'Laster ned …';
        const sub = await U.addListener('progress', (e) => { go.textContent = e.percent >= 0 ? 'Laster ned … ' + e.percent + ' %' : 'Laster ned …'; });
        await U.install({ url: l.apk });
        sub && sub.remove && sub.remove();
        go.textContent = 'Installer i dialogen'; hap('success');
      } catch (e) {
        go.disabled = false; go.textContent = 'Prøv igjen';
        err.textContent = e.message || String(e); hap('failure');
      }
    };
  }

  window.kiUpdate = { android, check, info };
})();
