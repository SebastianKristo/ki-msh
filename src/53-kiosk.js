/* Kiosk-modus (Fiks 22.9) · eget ark + logikk. Plugin: kiosk-mode (HACS, NemesisRE).
 * Åpnes fra «Mer» → Kiosk-modus (10-navbar), «Tilpass header» → Kiosk-innstillinger (20-hjem-header), GUI-editoren til
 * msh-hjem-card (seksjon «Kiosk», 25-hjem). Tittel-handlingen `kiosk` (hold) veksler samme bryter-entitet (MSH.kioskEntity).
 *
 * ki-store `kiosk` = { entity, rows: { mobile, non_admin, users }, devices: { <browser_mod-id>: { on, hide, when, name } } }
 *   rad = { on, hide: ['kiosk'] | ['hide_header', …], when: 'switch' | 'always', width (mobile), users (users) }
 * MSH.kioskConfig() → objektet strategien (04-strategy.js) skriver som `kiosk_mode` på rotnivå i dashbord-configen.
 *
 * Per enhet (kiosk-mode har ingen innstilling per nettleser): MSH.kioskTick(hass) kalles av msh-hjem-card ved hver
 * hass-oppdatering. Er denne nettleserens Browser Mod-ID (localStorage['browser_mod-browser-id']) valgt og aktiv, lastes
 * siden én gang med kiosk-mode sine URL-parametere + `cache` (f.eks. ?hide_header&cache), som kiosk-mode lagrer i sin
 * localStorage-cache. Slås enheten av (eller bryteren går av ved «Når bryteren er på»): ?clear_km_cache.
 * Antagelser (kiosk-mode-dokumentasjonen finnes ikke i repoet – etter README for kiosk-mode v6):
 *   - URL-parametere: kiosk, hide_header, hide_sidebar, hide_menubutton, hide_search, hide_assistant, hide_notifications,
 *     hide_account, hide_edit_dashboard; `cache` lagrer dem, `clear_km_cache` tømmer cachen.
 *   - Verdier i YAML kan være Jinja-maler ('{{ is_state(...) }}'), user_settings er en liste med `users: [navn]`.
 *   - Browser Mod-nettlesere: enhetsregisteret, identifiers [['browser_mod', <id>]] (ingen gjettede ID-er).
 * Det som sist ble brukt huskes i localStorage['ki_kiosk_applied'] (hindrer omlastingssløyfe).
 */
(function () {
  const M = window.MSH;
  if (!M || M.kioskSheet) return;
  const esc = M.esc;
  const DEF_ENT = 'input_boolean.kiosk_mode';
  const HIDE = [['kiosk', 'Alt'], ['hide_header', 'Header'], ['hide_sidebar', 'Sidebar'], ['hide_menubutton', 'Menyknapp'], ['hide_search', 'Søk'], ['hide_assistant', 'Assistent'], ['hide_notifications', 'Varsler'], ['hide_account', 'Konto'], ['hide_edit_dashboard', 'Rediger dashbord']];
  const HL = Object.fromEntries(HIDE);
  const ROWS = [['mobile', 'Mobil og smale skjermer', 'mdi:cellphone', 'mobile_settings'], ['non_admin', 'Ikke-administratorer', 'mdi:account-lock', 'non_admin_settings'], ['users', 'Brukere', 'mdi:account-multiple', 'user_settings']];
  const DEF_ROWS = { mobile: { on: true, hide: ['hide_header'], when: 'switch', width: 1000 }, non_admin: { on: true, hide: ['kiosk'], when: 'always' }, users: { on: false, hide: ['kiosk'], when: 'switch', users: [] } };
  const BID_KEY = 'browser_mod-browser-id', APPLIED = 'ki_kiosk_applied';
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* */ } } };

  const K = () => (M.store && M.store.get('kiosk')) || {};
  M.kioskEntity = () => K().entity || DEF_ENT;
  const rowOf = (k) => ({ ...DEF_ROWS[k], ...((K().rows || {})[k] || {}) });
  const devs = () => K().devices || {};
  const tpl = (ent) => `{{ is_state("${ent}", "on") }}`;
  const valOf = (r) => (r.when === 'always' ? true : tpl(M.kioskEntity()));
  const hideOf = (r) => { const h = (r.hide || []).filter((x) => HL[x]); return h.length ? (h.includes('kiosk') ? ['kiosk'] : h) : ['kiosk']; };
  const settings = (r) => { const v = valOf(r), o = {}; hideOf(r).forEach((h) => { o[h] = v; }); return o; };

  // kiosk_mode-objektet (bare aktive grupper). Tomt → null.
  M.kioskConfig = function () {
    const out = {};
    const m = rowOf('mobile'), n = rowOf('non_admin'), u = rowOf('users');
    if (m.on) out.mobile_settings = { ...settings(m), custom_width: Number(m.width) || 1000 };
    if (n.on) out.non_admin_settings = settings(n);
    if (u.on && (u.users || []).length) out.user_settings = [{ users: [...u.users], ...settings(u) }];
    return Object.keys(out).length ? out : null;
  };
  M.kioskYaml = () => { const c = M.kioskConfig(); return c ? M.yaml.dump({ kiosk_mode: c }) : '# kiosk_mode: ingen aktive grupper'; };
  const count = () => ROWS.filter(([k]) => rowOf(k).on).length + Object.values(devs()).filter((d) => d && d.on).length;
  M.kioskCount = count; // Fiks 23.5: «påvirker N valg» også i «Tilpass navbar»
  const summary = (r, k) => {
    const h = hideOf(r), what = h.includes('kiosk') ? 'Skjuler alt' : 'Skjuler ' + h.map((x) => HL[x].toLowerCase()).join(', ');
    const pre = k === 'mobile' ? `Under ${Number(r.width) || 1000} px · ` : k === 'users' ? `${(r.users || []).length ? r.users.join(', ') : 'Ingen brukere valgt'} · ` : '';
    return `${pre}${what} · ${r.when === 'always' ? 'alltid' : 'når bryteren er på'}`;
  };
  const save = (path, v) => M.store.set('kiosk' + (path ? '.' + path : ''), v, { now: true });

  /* ------------------------------------------------------------ per enhet */
  const qs = (hide) => '?' + hide.join('&') + '&cache';
  M.kioskDeviceWant = function (hass, id) {
    const d = id && devs()[id];
    if (!d || !d.on) return '';
    const ent = M.kioskEntity(), s = hass && hass.states && hass.states[ent];
    const active = d.when === 'always' || (s && s.state === 'on');
    return active ? hideOf(d).join('&') : '';
  };
  let ticking = false;
  M.kioskTick = async function (hass) {
    if (ticking || !hass || !M.store) return;
    ticking = true;
    try {
      await M.store.load(hass);
      M.kioskHass = hass;
      const id = ls.get(BID_KEY);
      if (!id) return;
      const want = M.kioskDeviceWant(hass, id), had = ls.get(APPLIED) || '';
      if (want === had) return;
      ls.set(APPLIED, want || null);
      const u = new URL(location.href);
      u.search = want ? qs(want.split('&')) : '?clear_km_cache';
      location.replace(u.toString());
    } finally { ticking = false; }
  };

  /* ------------------------------------------------------------ data: brukere og Browser Mod */
  async function loadUsers(h) {
    try { const r = await h.callWS({ type: 'config/auth/list' }); return (r || []).filter((u) => !u.system_generated && u.is_active !== false).map((u) => u.name).filter(Boolean); } catch (e) { return Object.keys(h.states).filter((x) => x.startsWith('person.')).map((x) => M.name ? M.name(h, x) : x); }
  }
  async function loadBrowsers(h) {
    let list = null;
    try {
      const d = await h.callWS({ type: 'config/device_registry/list' });
      list = (d || []).map((x) => { const i = (x.identifiers || []).find((p) => p[0] === 'browser_mod'); return i ? { id: String(i[1]), name: x.name_by_user || x.name || String(i[1]) } : null; }).filter(Boolean);
    } catch (e) { /* */ }
    const hasBM = (list && list.length) || !!customElements.get('browser-mod-popup') || Object.values(h.entities || {}).some((e) => e.platform === 'browser_mod');
    return hasBM ? list || [] : null;
  }

  /* ------------------------------------------------------------ arket */
  const CSS = `
    .body{display:flex;flex-direction:column;gap:12px;padding:4px 16px 20px}
    .top{display:flex;align-items:center;gap:12px;padding:16px;border-radius:24px;background:var(--gray100,#2f2f2f)}
    .ic{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;background:rgba(255,255,255,0.08);color:#afafaf;flex:none}
    .ic.on{background:rgba(125,213,140,0.18);color:#7dd58c}
    .tt{flex:1;min-width:0}.tt b{display:block;font-size:16px;font-weight:600}.tt span{font-size:12px;color:#979797}
    .h{font-size:13px;color:#979797;margin:6px 4px 0}
    .row{border-radius:22px;background:var(--gray100,#2f2f2f);overflow:hidden}
    .rh{display:flex;align-items:center;gap:10px;padding:12px 14px;width:100%;text-align:left}
    .rh .tt b{font-size:14px;font-weight:500}
    .ex{display:flex;flex-direction:column;gap:8px;padding:0 14px 14px}
    .chips{display:flex;flex-wrap:wrap;gap:6px}
    .chip{height:32px;padding:0 12px;border-radius:16px;background:var(--gray000,#232323);color:#afafaf;font-size:13px}
    .chip.on{background:var(--pink,#f285c9);color:#232323}
    .lab{font-size:12px;color:#7f7f7f}
    .trk{position:relative;width:44px;height:26px;border-radius:13px;flex:none;background:var(--gray200,#3a3a3a);transition:background .2s}
    .trk.on{background:#7dd58c}.trk i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:10px;background:#fafafa;transition:left .2s}.trk.on i{left:21px}
    .stp{display:flex;align-items:center;gap:8px}.stp button{width:36px;height:32px;border-radius:16px;background:var(--gray000,#232323);font-size:18px}.stp span{min-width:70px;text-align:center;font-size:13px}
    .me{font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(242,133,201,0.2);color:#f285c9;margin-left:6px}
    input.ent{height:40px;border-radius:14px;border:0;padding:0 12px;background:var(--gray000,#232323);color:inherit;font:inherit;font-size:13px}
    pre{margin:0;padding:12px;border-radius:16px;background:var(--gray000,#232323);font-size:12px;line-height:1.4;overflow:auto;white-space:pre}
    .btn{height:44px;border-radius:22px;background:var(--gray200,#3a3a3a);font-size:14px;font-weight:500}
    .btn.pk{background:var(--pink,#f285c9);color:#232323;font-weight:600}
    .note{font-size:12px;color:#979797;padding:0 4px}
    .rl{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:18px;background:rgba(242,133,201,0.12);font-size:13px}
    button{border:0;background:none;color:inherit;font:inherit;cursor:pointer}
  `;
  const sw = (on, a, extra = '') => `<button class="trk ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" data-a="${a}" ${extra}><i></i></button>`;

  M.kioskSheet = function (card) {
    let hass = (card && card.hass) || M.kioskHass || (document.querySelector('home-assistant') || {}).hass;
    if (!hass) return null;
    const st = { open: {}, users: null, browsers: undefined, dirty: false };
    const render = () => {
      const ent = M.kioskEntity(), s = hass.states[ent], on = s && s.state === 'on', n = count();
      const myId = ls.get(BID_KEY);
      const hideChips = (r, scope) => `<span class="lab">Skjul</span><div class="chips">${HIDE.map(([k, l]) => `<button class="chip ${hideOf(r).includes(k) ? 'on' : ''}" data-a="hide" data-s="${esc(scope)}" data-v="${k}">${esc(l)}</button>`).join('')}</div>
        <span class="lab">Når</span><div class="chips"><button class="chip ${r.when !== 'always' ? 'on' : ''}" data-a="when" data-s="${esc(scope)}" data-v="switch">Når bryteren er på</button><button class="chip ${r.when === 'always' ? 'on' : ''}" data-a="when" data-s="${esc(scope)}" data-v="always">Alltid</button></div>`;
      const row = (scope, title, icon, r, extra, badge) => `<div class="row" data-key="r-${esc(scope)}"><div class="rh"><button class="tt" data-a="exp" data-s="${esc(scope)}" style="display:flex;gap:10px;align-items:center;text-align:left">${M.icon(icon, 22)}<span style="min-width:0"><b>${esc(title)}${badge || ''}</b><span style="display:block;font-size:12px;color:#979797">${esc(r.on ? summary(r, scope) : 'Av')}</span></span></button>${sw(r.on, 'row', `data-s="${esc(scope)}"`)}</div>${st.open[scope] ? `<div class="ex">${extra || ''}${hideChips(r, scope)}</div>` : ''}</div>`;
      const m = rowOf('mobile'), u = rowOf('users');
      const userChips = st.users ? `<span class="lab">Brukere</span><div class="chips">${st.users.map((x) => `<button class="chip ${(u.users || []).includes(x) ? 'on' : ''}" data-a="user" data-v="${esc(x)}">${esc(x)}</button>`).join('') || '<span class="note">Fant ingen brukere</span>'}</div>` : '<span class="note">Henter brukere …</span>';
      let devHtml;
      if (st.browsers === undefined) devHtml = '<span class="note">Henter enheter …</span>';
      else if (st.browsers === null) devHtml = '<span class="note">Installer Browser Mod for å velge enheter</span>';
      else if (!st.browsers.length) devHtml = '<span class="note">Ingen registrerte nettlesere i Browser Mod</span>';
      else devHtml = st.browsers.map((b) => { const d = { hide: ['kiosk'], when: 'switch', ...(devs()[b.id] || {}) }; return row('dev:' + b.id, b.name, 'mdi:monitor-cellphone', d, '', b.id === myId ? '<span class="me">Denne enheten</span>' : ''); }).join('');
      return `<div class="top" data-key="top"><div class="ic ${on ? 'on' : ''}">${M.icon('mdi:fullscreen', 24)}</div><div class="tt"><b>Kiosk-modus er ${on ? 'på' : 'av'}</b><span>${esc(ent)} · påvirker ${n} valg</span></div>${sw(on, 'master')}</div>
        <span class="lab" style="margin:0 4px">Bryter-entitet</span><input class="ent" data-key="ent" value="${esc(ent)}" placeholder="${DEF_ENT}">
        <div class="h">Grupper</div>
        ${row('mobile', ROWS[0][1], ROWS[0][2], m, `<span class="lab">Bredde (custom_width)</span><div class="stp"><button data-a="w" data-v="-50">−</button><span>${Number(m.width) || 1000} px</span><button data-a="w" data-v="50">+</button></div>`)}
        ${row('non_admin', ROWS[1][1], ROWS[1][2], rowOf('non_admin'))}
        ${row('users', ROWS[2][1], ROWS[2][2], u, userChips)}
        <div class="h">Enheter</div>${devHtml}
        <div class="h">YAML</div><pre data-key="yaml">${esc(M.kioskYaml())}</pre>
        <button class="btn" data-a="copy">Kopier</button>
        ${st.dirty ? `<div class="rl" data-key="rl"><span style="flex:1">Last inn på nytt for å bruke</span><button class="btn pk" style="padding:0 16px;height:36px" data-a="reload">Last inn på nytt</button></div>` : ''}
        <button class="btn pk" data-a="close">Ferdig</button>`;
    };
    const ov = M.overlay({ html: render(), css: CSS, maxWidth: 480, onClose: () => { unsub && unsub(); } });
    const upd = () => { if (ov.host.isConnected) M.morph(ov.body, render()); };
    const unsub = M.store.subscribe((d, p) => { if (!p || /^kiosk/.test(p)) upd(); });
    loadUsers(hass).then((u) => { st.users = u; upd(); });
    loadBrowsers(hass).then((b) => { st.browsers = b; upd(); });
    const setRow = (scope, patch) => {
      st.dirty = true;
      if (scope.startsWith('dev:')) { const id = scope.slice(4), b = (st.browsers || []).find((x) => x.id === id); save('devices.' + id, { hide: ['kiosk'], when: 'switch', ...(devs()[id] || {}), name: b ? b.name : id, ...patch }); } else save('rows.' + scope, { ...rowOf(scope), ...patch });
    };
    const cur = (scope) => (scope.startsWith('dev:') ? { hide: ['kiosk'], when: 'switch', ...(devs()[scope.slice(4)] || {}) } : rowOf(scope));
    ov.root.addEventListener('change', (e) => {
      if (e.target.classList.contains('ent')) { M.haptic('selection'); st.dirty = true; save('entity', String(e.target.value || '').trim() || undefined); }
    });
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]');
      if (!el) return;
      const a = el.dataset.a, s = el.dataset.s, v = el.dataset.v;
      M.haptic(a === 'master' || a === 'row' ? 'medium' : 'selection');
      switch (a) {
        case 'close': return ov.close();
        case 'master': { const ent = M.kioskEntity(); if (!hass.states[ent]) return M.toast('Fant ikke ' + ent); M.call(hass, ent.split('.')[0] === 'input_boolean' ? 'input_boolean' : 'homeassistant', 'toggle', { entity_id: ent }); return; }
        case 'exp': st.open[s] = !st.open[s]; return upd();
        case 'row': { const r = cur(s); setRow(s, { on: !r.on }); if (!r.on) st.open[s] = true; return upd(); }
        case 'hide': {
          let h = hideOf(cur(s));
          if (v === 'kiosk') h = ['kiosk'];
          else { h = h.filter((x) => x !== 'kiosk'); h = h.includes(v) ? h.filter((x) => x !== v) : [...h, v]; }
          if (!h.length) { M.toast('Minst ett valg må være aktivt'); return; }
          return setRow(s, { hide: h });
        }
        case 'when': return setRow(s, { when: v });
        case 'w': return setRow('mobile', { width: M.clamp((Number(rowOf('mobile').width) || 1000) + Number(v), 300, 3000) });
        case 'user': { const u = rowOf('users').users || []; return setRow('users', { users: u.includes(v) ? u.filter((x) => x !== v) : [...u, v] }); }
        case 'copy': { const t = M.kioskYaml(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => M.toast('YAML kopiert'), () => M.toast('Kunne ikke kopiere')); return; }
        case 'reload': return location.reload();
        default:
      }
    });
    // bryteren (hass) endres utenfor arket → oppdater toppkortet
    const iv = setInterval(() => { if (!ov.host.isConnected) return clearInterval(iv); const h2 = M.kioskHass; if (h2 && h2.states) hass = h2; upd(); }, 1000);
    return ov;
  };
  // Åpnes via hendelse også (f.eks. fra kort som ikke kjenner MSH.kioskSheet ennå)
  window.addEventListener('ki-open-kiosk', () => M.kioskSheet());
})();
