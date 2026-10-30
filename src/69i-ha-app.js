/* KI MSH · Home Assistant-innstillinger, bolk 2: Companion-appen.
 * Profil øverst i hub-en, og seksjonen «Companion-appen»: servere, Glimt AI, denne enheten (sensorer, varsler,
 * posisjon, widgets, NFC, klokke, feilsøking). Appinnstillingene lagres lokalt (ki-proto-app); profilvalg som finnes
 * i HA (navn, språk, avansert modus) sendes til HA når den er tilkoblet.
 */
(function () {
  const M = window.MSH;
  if (!M || !M.ha || M.ha.appPages) return;
  const esc = M.esc, ui = M.ha.ui;
  const T = (n, e) => (window.kiT ? window.kiT(n, e) : n);
  const AND = /android/.test(location.search) || /Android/.test(navigator.userAgent);
  const LS = 'ki-proto-app';
  const DEF = {
    server: 'hjem', servers: [{ id: 'hjem', name: 'Hjem', url: 'http://homeassistant.local:8123', ext: '', ssid: 'Hjem-WiFi' }],
    device: AND ? 'Pixel 8' : 'Sebastians iPhone',
    sensors: { battery_level: true, battery_state: true, location: true, wifi: true, activity: false, steps: false, storage: false, app_state: true, focus: false, next_alarm: AND, connection: true },
    notif: { push: true, critical: true, sound: true, actions: true },
    loc: { mode: 'zones', background: true, accuracy: 'balanced' },
    widgets: [], tiles: [], watch: [], kiosk: false, haptics: true, theme: 'auto', lang: 'nb', log: [],
    history: [
      { t: Date.now() - 18 * 60e3, title: 'Vaskemaskin', msg: 'Klar til å tømmes', actions: ['Utsett 30 min'] },
      { t: Date.now() - 3 * 3600e3, title: 'Ringeklokke', msg: 'Noen ringte på', actions: ['Åpne kamera', 'Lås opp'] },
      { t: Date.now() - 26 * 3600e3, title: 'Strøm', msg: 'Høy pris de neste to timene', actions: [] },
    ],
  };
  let D; try { D = { ...DEF, ...(JSON.parse(localStorage.getItem(LS)) || {}) }; } catch (e) { D = { ...DEF }; }
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(D)); } catch (e) {} };
  const log = (m) => { D.log = [{ t: Date.now(), m }, ...(D.log || [])].slice(0, 60); save(); };
  const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const rel = (t) => (M.relTime ? M.relTime(new Date(t).toISOString()) : new Date(t).toLocaleString());
  const glimt = () => { try { return JSON.parse(localStorage.getItem('ki-proto-glimt') || '{}'); } catch (e) { return {}; } };
  const srv = () => D.servers.find((s) => s.id === D.server) || D.servers[0];
  // Tema i hele dashbordet: Auto følger telefonen, ellers tvinges lys/mørk (overstyrer HAs darkMode for MSH.theme)
  const themeMode = () => (D.theme === 'auto' ? (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : D.theme === 'light' ? 'light' : 'dark');
  // I Home Assistants eget grensesnitt betyr Auto «følg HA» (HAs darkMode følger allerede brukerens temavalg/telefonen)
  // (test/harness.html setter __kiInHA: testene styrer modus via hass.themes.darkMode som i HA, ikke via nettleserens prefers-color-scheme)
  const inHA = () => !!document.querySelector('home-assistant') || !!window.__kiInHA;
  const follow = () => D.theme === 'auto' && inHA();
  const applyTheme = () => {
    const T0 = M.theme; if (!T0 || !T0.set) return;
    if (!T0.__u0) { T0.__u0 = T0.update; T0.update = (h) => T0.__u0.call(T0, h && !follow() ? { ...h, themes: { ...(h.themes || {}), darkMode: themeMode() !== 'light' } } : h); }
    if (follow()) { if (M.lastHass) T0.update(M.lastHass); return; }
    T0.set(themeMode());
    try { window.parent.postMessage({ kiThemeMode: themeMode() }, '*'); } catch (e) {}
  };
  M.ha.applyTheme = applyTheme;
  setTimeout(applyTheme, 0);
  try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (D.theme === 'auto') applyTheme(); }); } catch (e) {}
  const C = { blue: 'var(--blue,#73b9f2)', pink: 'var(--pink,#f285c9)', green: 'var(--green,#66d19e)', orange: 'var(--orange,#f2b573)', purple: 'var(--purple,#ad99e6)', teal: 'var(--teal,#5fc4c4)', glimt: '#e8794a', yellow: 'var(--yellow,#f2d26f)', red: 'var(--red,#f28073)' };

  /* ------------------------------------------------------------ hub: profil + companion-seksjon */
  M.ha.appTop = (c) => {
    const h = c.h, u = h && h.user, p = Object.values((h && h.states) || {}).find((s) => s.entity_id.startsWith('person.') && u && s.attributes.user_id === u.id) || (h && h.states['person.sebastian']);
    const pic = p && p.attributes.entity_picture, nm = (u && u.name) || (p && p.attributes.friendly_name) || 'Deg';
    return `<button class="card prof" data-a="go" data-v="profile" style="flex-direction:row;align-items:center;gap:16px;text-align:left"><span class="pav">${pic ? `<img src="${esc(pic)}" alt="">` : esc(nm[0])}</span><span class="ht"><b data-noi18n style="font-size:19px">${esc(nm)}</b><i>${esc(u && u.is_admin === false ? T('Bruker', 'User') : T('Administrator', 'Administrator'))} · <span data-noi18n>${esc(srv().name)}</span></i></span>${ui.ic('mdi:chevron-right', 22, 'color:var(--ki-text-3,#7f7f7f)')}</button>
      <style>.pav{width:60px;height:60px;border-radius:30px;flex:none;display:grid;place-items:center;overflow:hidden;font-size:24px;font-weight:600;color:#2a1720;background:linear-gradient(145deg,#f2b573,#f28073)}.pav img{width:100%;height:100%;object-fit:cover}.prof:active{transform:scale(.98)}</style>`;
  };
  M.ha.tpSection = () => { M.ha.appSection(); return M.ha._tpSec || ''; };
  M.ha.appSection = () => {
    // TODO(Glimt-konto): leverandøren 'glimt' (konto delt med Nordlys OS, POST {server}/api/auth/login → token, chat via
    // POST {server}/api/chat med Bearer) er bare beskrevet i Claude Design-handoffen – app/prototype/ki/glimt.js har den ikke ennå,
    // og API-et er ikke sjekket mot Glimt-tjenesten i Nordlys OS. Bare etiketten finnes her.
    const g = glimt(), gs = g.provider === 'glimt' ? `Glimt-konto${g.glimtUser ? ' · ' + g.glimtUser : ''}` : g.provider === 'ollama' ? `Ollama · ${g.ollamaModel || 'qwen2.5:7b'}` : g.provider === 'off' ? T('Av', 'Off') : 'Claude · sky';
    const n = (D.history || []).length, s = srv();
    // Tilpass (samme valg som Mer → Tilpass i navbaren): åpner de vanlige Tilpass-arkene
    // Runde 2: samme innganger, titler og undertitler som Mer → Tilpass (MSH.tp.entries); fargene er hub-ens egne
    const TPC = { alt: C.pink, home: C.blue, navbar: C.orange, header: C.green, kiosk: C.purple };
    const TPS = { alt: !!M.openTilpassAlt, home: true, navbar: true, header: true, kiosk: !!M.kioskSheet };
    const TP = (M.tp ? M.tp.entries(Object.keys(TPC)) : []).filter((e) => TPS[e[0]]).map(([k, icon, title, sub]) => [k, icon, TPC[k], title, sub || (k === 'kiosk' ? 'Skjul alt utenom dashbordet' : '')]);
    const tpSec = `${ui.sec(T('Tilpass dashbordet', 'Customize dashboard'))}${ui.group(TP.map(([k, icon, bg, title, sub]) => ui.row({ a: 'tp', v: k, icon, iconBg: bg, title, sub, chev: true })))}`;
    M.ha._tpSec = tpSec;
    return `${ui.sec(T('Companion-appen', 'Companion app'))}${ui.group([
      ui.row({ a: 'go', v: 'servers', icon: 'mdi:server-network', iconBg: C.purple, title: T('Servere', 'Servers'), sub: `${s.name} · ${String(s.url).replace(/^https?:\/\//, '')}`, chev: true }),
      ui.row({ a: 'glimt', icon: 'mdi:creation', iconBg: C.glimt, title: 'Glimt AI', sub: gs, chev: true }),
      ui.row({ a: 'go', v: 'appdevice', icon: 'mdi:cellphone-cog', iconBg: C.teal, title: T('Denne enheten', 'This device'), sub: `${D.device} · mobile_app_${slug(D.device)}`, chev: true }),
      ui.row({ a: 'go', v: 'notifs', icon: 'mdi:bell-outline', iconBg: C.pink, title: T('Varsler', 'Notifications'), sub: n ? `${n} ${T('siste varsler', 'recent notifications')}` : T('Ingen varsler', 'No notifications'), chev: true }),
    ].join(''))}`;
  };

  /* ------------------------------------------------------------ profil */
  M.ha.page('profile', {
    title: () => T('Profil', 'Profile'),
    haPath: '/profile/general',
    render(c) {
      const h = c.h, u = (h && h.user) || {};
      const seg = (k, opts) => ui.seg('p:' + k, D[k], opts);
      return `${ui.field({ f: 'name', value: u.name || '', label: T('Visningsnavn', 'Display name') })}
        <div class="fd"><span class="fl">${esc(T('Språk', 'Language'))}</span>${seg('lang', [['nb', 'Norsk'], ['en', 'English']])}</div>
        <div class="fd"><span class="fl">${esc(T('Tema', 'Theme'))}</span>${seg('theme', [['auto', T('Auto')], ['dark', T('Mørkt', 'Dark')], ['light', T('Lyst', 'Light')]])}</div>
        ${ui.group([ui.row({ a: 'tg', v: 'haptics', icon: 'mdi:vibrate', title: T('Haptisk tilbakemelding', 'Haptic feedback'), right: ui.sw(D.haptics, 'tg', 'haptics') }), ui.row({ a: 'tg', v: 'kiosk', icon: 'mdi:fullscreen', title: T('Kiosk-modus', 'Kiosk mode'), sub: T('Skjul alt utenom dashbordet på denne enheten', 'Hide everything but the dashboard on this device'), right: ui.sw(D.kiosk, 'tg', 'kiosk') }), ui.row({ a: 'adv', icon: 'mdi:school-outline', title: T('Avansert modus', 'Advanced mode'), sub: T('Viser YAML, utviklerverktøy og mer i HA', 'Shows YAML, developer tools and more in HA'), right: ui.sw(!!(h && h.userData && h.userData.showAdvanced), 'adv') })].join(''))}
        ${ui.group([ui.row({ a: 'ext', v: '/profile/security', icon: 'mdi:shield-key-outline', title: T('Sikkerhet', 'Security'), sub: T('Passord, tofaktor og tokener', 'Password, MFA and tokens'), ext: true }), ui.row({ a: 'go', v: 'persons', icon: 'mdi:account-group-outline', title: T('Personer', 'People'), chev: true })].join(''))}
        <button class="bt warn" data-a="logout" style="height:52px;justify-content:center">${ui.ic('mdi:logout', 18)}<span>${esc(T('Logg ut', 'Log out'))}</span></button>`;
    },
    input(c, el, v, commit) { if (el.dataset.f === 'name' && commit && v.trim()) c.ws('config/auth/update', { user_id: c.h.user && c.h.user.id, name: v.trim() }).then(() => { M.haptic('success'); c.toast(T('Navnet er lagret', 'Name saved')); }).catch(() => c.toast(T('Lagret lokalt', 'Saved locally'))); },
    act(c, a, el) {
      const v = el.dataset.v;
      if (a === 'seg' && el.dataset.f.startsWith('p:')) { const k = el.dataset.f.slice(2); D[k] = v; save(); M.haptic('selection'); if (k === 'lang' && window.kiSetLang) window.kiSetLang(v); if (k === 'theme') applyTheme(); return c.render(); }
      if (a === 'tg') { D[v] = !D[v]; save(); M.haptic('selection'); return c.render(); }
      if (a === 'adv') return c.ws('frontend/set_user_data', { key: 'core', value: { showAdvanced: !(c.h.userData && c.h.userData.showAdvanced) } }).then(() => { M.haptic('selection'); c.render(); }).catch((e) => c.err(e));
      if (a === 'logout') { c.close(); log('Logget ut'); return window.parent && window.parent.postMessage({ kiLogout: true }, '*'); }
      return undefined;
    },
  });

  /* ------------------------------------------------------------ servere */
  M.ha.page('servers', {
    title: () => T('Servere', 'Servers'),
    render() {
      return `<p class="mut" style="margin:0 6px">${esc(T('Appen kan kobles til flere Home Assistant-servere. Den aktive brukes for dashbordet, varsler og sensorer.', 'The app can connect to several servers. The active one is used for the dashboard, notifications and sensors.'))}</p>
        ${ui.group(D.servers.map((s) => ui.row({ a: 'srv', v: s.id, icon: 'mdi:home-assistant', iconBg: s.id === D.server ? C.green : null, title: s.name, sub: String(s.url).replace(/^https?:\/\//, ''), right: s.id === D.server ? `<span class="tag ok">${esc(T('Aktiv', 'Active'))}</span>` : '', chev: true })).join(''))}
        <button class="fab" data-a="add">${ui.ic('mdi:plus', 22)}${esc(T('Legg til server', 'Add server'))}</button>`;
    },
    act(c, a, el) {
      if (a === 'srv') return c.push('server', { id: el.dataset.v });
      if (a === 'add') { const id = 's' + Date.now().toString(36); D.servers.push({ id, name: T('Ny server', 'New server'), url: 'https://', ext: '', ssid: '' }); save(); return c.push('server', { id }); }
      return undefined;
    },
    reload: true,
  });
  M.ha.page('server', {
    title: (c, a) => { const s = D.servers.find((x) => x.id === a.id); return s ? s.name : T('Server', 'Server'); },
    render(c, a) {
      const s = D.servers.find((x) => x.id === a.id); if (!s) return ui.empty('mdi:server-off', T('Fant ikke serveren', 'Server not found'));
      const st = c.state.test;
      return `${ui.field({ f: 'name', value: s.name, label: T('Navn', 'Name') })}${ui.field({ f: 'url', value: s.url, label: T('Intern URL (hjemme)', 'Internal URL (home)'), mono: true })}${ui.field({ f: 'ext', value: s.ext, label: T('Ekstern URL', 'External URL'), ph: 'https://xxxx.ui.nabu.casa', mono: true })}${ui.field({ f: 'ssid', value: s.ssid, label: T('Hjemmenettverk (Wi-Fi)', 'Home network (Wi-Fi)'), hint: T('Intern URL brukes på dette nettverket', 'Internal URL is used on this network') })}
        <div class="bts">${ui.btn(c.isBusy('t') ? T('Tester …', 'Testing …') : T('Test tilkobling', 'Test connection'), 'test', null, '', 'mdi:lan-check')}${s.id !== D.server ? ui.btn(T('Bruk denne', 'Use this'), 'use', null, 'pri', 'mdi:swap-horizontal') : ''}</div>
        ${st ? `<div class="card"><span class="${st.ok ? 'ok' : 'err'}">${esc(st.msg)}</span></div>` : ''}
        ${D.servers.length > 1 ? `<button class="bt warn" data-a="del" style="height:48px;justify-content:center">${ui.ic('mdi:delete-outline', 18)}<span>${esc(c.armed('del') ? T('Trykk igjen for å fjerne', 'Tap again to remove') : T('Fjern server', 'Remove server'))}</span></button>` : ''}`;
    },
    input(c, el, v, commit, a) { const s = D.servers.find((x) => x.id === a.id); if (s && el.dataset.f) { s[el.dataset.f] = v; save(); } },
    act(c, a, el, args) {
      const s = D.servers.find((x) => x.id === args.id);
      if (a === 'use') { D.server = s.id; save(); log('Byttet til ' + s.name); M.haptic('success'); c.toast(T('Byttet server', 'Switched server')); return c.render(); }
      if (a === 'del') { if (!c.confirm('del')) return undefined; D.servers = D.servers.filter((x) => x !== s); if (D.server === s.id) D.server = D.servers[0].id; save(); return c.pop(); }
      if (a === 'test') {
        const u = String(s.url).replace(/\/$/, '');
        return c.busy('t', fetch(u + '/manifest.json', { mode: 'no-cors' }).then(() => ({ ok: true, msg: T('Svarer · ', 'Responds · ') + u })).catch(() => ({ ok: false, msg: T('Fikk ikke kontakt. Sjekk adressen og nettverket.', 'Could not connect. Check the address and network.') }))).then((r) => { c.state.test = r; log('Test ' + u + ': ' + (r.ok ? 'OK' : 'feil')); M.haptic(r.ok ? 'success' : 'warning'); c.render(); });
      }
      return undefined;
    },
  });

  /* ------------------------------------------------------------ denne enheten */
  const SENS = [
    ['battery_level', 'mdi:battery-70', 'Batterinivå', () => '72 %'], ['battery_state', 'mdi:battery-charging', 'Ladestatus', () => T('Lader ikke', 'Not charging')],
    ['location', 'mdi:map-marker-outline', 'Posisjon', () => T('Hjem', 'Home')], ['wifi', 'mdi:wifi', 'Wi-Fi', () => srv().ssid || 'Hjem-WiFi'],
    ['connection', 'mdi:signal-cellular-3', 'Tilkoblingstype', () => 'Wi-Fi'], ['activity', 'mdi:walk', 'Aktivitet', () => T('Stille', 'Stationary')],
    ['steps', 'mdi:shoe-print', 'Skritt', () => '4 812'], ['storage', 'mdi:harddisk', 'Lagring', () => '61 % ledig'],
    ['app_state', 'mdi:cellphone', 'Appstatus', () => T('Forgrunn', 'Foreground')], ['focus', 'mdi:moon-waning-crescent', AND ? 'Ikke forstyrr' : 'Fokus', () => T('Av', 'Off')],
    ['next_alarm', 'mdi:alarm', 'Neste alarm', () => '06:30'],
  ];
  M.ha.page('appdevice', {
    title: () => T('Denne enheten', 'This device'), sub: () => `mobile_app_${slug(D.device)}`,
    render(c) {
      const on = Object.values(D.sensors).filter(Boolean).length;
      return `${ui.field({ f: 'device', value: D.device, label: T('Enhetsnavn', 'Device name'), hint: `notify.mobile_app_${slug(D.device)}` })}
        ${ui.group([
          ui.row({ a: 'go', v: 'appsensors', icon: 'mdi:radar', iconBg: C.blue, title: T('Sensorer', 'Sensors'), sub: `${on} ${T('av', 'of')} ${SENS.length} ${T('sendes til Home Assistant', 'sent to Home Assistant')}`, chev: true }),
          ui.row({ a: 'go', v: 'apploc', icon: 'mdi:crosshairs-gps', iconBg: C.green, title: T('Posisjonssporing', 'Location tracking'), sub: { zones: T('Bare ved soneskifte', 'Only on zone changes'), always: T('Alltid', 'Always'), off: T('Av', 'Off') }[D.loc.mode], chev: true }),
          ui.row({ a: 'go', v: 'appnotif', icon: 'mdi:bell-cog-outline', iconBg: C.pink, title: T('Varslingsinnstillinger', 'Notification settings'), sub: D.notif.push ? T('Push er på', 'Push is on') : T('Push er av', 'Push is off'), chev: true }),
          ui.row({ a: 'go', v: 'appwidgets', icon: AND ? 'mdi:widgets-outline' : 'mdi:apps', iconBg: C.yellow, title: AND ? T('Widgets og hurtigfliser', 'Widgets and quick tiles') : T('Widgets og snarveier', 'Widgets and shortcuts'), sub: `${D.widgets.length + D.tiles.length} ${T('i bruk', 'in use')}`, chev: true }),
          ui.row({ a: 'go', v: 'appnfc', icon: 'mdi:nfc-variant', iconBg: C.orange, title: T('NFC-brikker', 'NFC tags'), sub: T('Skriv og les brikker', 'Write and read tags'), chev: true }),
          ui.row({ a: 'go', v: 'appwatch', icon: AND ? 'mdi:watch-variant' : 'mdi:watch', iconBg: C.purple, title: AND ? 'Wear OS' : 'Apple Watch', sub: `${D.watch.length} ${T('handlinger', 'actions')}`, chev: true }),
          ui.row({ a: 'go', v: 'applog', icon: 'mdi:bug-outline', iconBg: C.red, title: T('Feilsøking', 'Troubleshooting'), sub: T('Logg, tilkobling og cache', 'Log, connection and cache'), chev: true }),
        ].join(''))}
        <div class="bts">${ui.btn(T('Send testvarsel', 'Send test notification'), 'test', null, '', 'mdi:bell-ring-outline')}${ui.btn(T('Oppdater sensorer', 'Update sensors'), 'upd', null, '', 'mdi:refresh')}</div>`;
    },
    input(c, el, v, commit) { if (el.dataset.f === 'device' && commit) { D.device = v.trim() || D.device; save(); log('Nytt enhetsnavn: ' + D.device); c.render(); } },
    act(c, a) {
      if (a === 'test') { D.history.unshift({ t: Date.now(), title: 'Home Assistant', msg: T('Dette er et testvarsel', 'This is a test notification'), actions: [] }); save(); log('Testvarsel sendt'); M.haptic('success'); if (window.kiNote) window.kiNote(T('Testvarsel: Dette er et testvarsel', 'Test notification')); return c.toast(T('Testvarsel sendt', 'Test notification sent')); }
      if (a === 'upd') { log('Sensorer oppdatert'); M.haptic('success'); return c.toast(T('Sensorene er oppdatert', 'Sensors updated')); }
      return undefined;
    },
  });
  M.ha.page('appsensors', {
    title: () => T('Sensorer', 'Sensors'), sub: () => T('Hva telefonen sender til HA', 'What the phone sends to HA'),
    render() { return ui.group(SENS.map(([k, ic, n, val]) => ui.row({ a: 'sn', v: k, icon: ic, title: T(n), subHtml: `<span data-noi18n>sensor.${slug(D.device)}_${k}</span> · ${esc(D.sensors[k] ? val() : T('av', 'off'))}`, right: ui.sw(!!D.sensors[k], 'sn', k) })).join('')); },
    act(c, a, el) { if (a === 'sn') { const k = el.dataset.v; D.sensors[k] = !D.sensors[k]; save(); log(`Sensor ${k}: ${D.sensors[k] ? 'på' : 'av'}`); M.haptic('selection'); return c.render(); } return undefined; },
  });
  M.ha.page('apploc', {
    title: () => T('Posisjonssporing', 'Location tracking'),
    render() {
      return `${ui.seg('mode', D.loc.mode, [['zones', T('Soner', 'Zones')], ['always', T('Alltid', 'Always')], ['off', T('Av', 'Off')]])}
        <p class="mut" style="margin:0 6px">${esc({ zones: T('Sender posisjon når du kommer til eller forlater en sone. Sparer batteri.', 'Sends location when you enter or leave a zone. Saves battery.'), always: T('Sender posisjon jevnlig, også i bakgrunnen. Mest nøyaktig kart.', 'Sends location regularly, also in the background.'), off: T('Home Assistant får ikke vite hvor du er.', 'Home Assistant will not know where you are.') }[D.loc.mode])}</p>
        ${D.loc.mode === 'off' ? '' : `<div class="fd"><span class="fl">${esc(T('Nøyaktighet', 'Accuracy'))}</span>${ui.seg('acc', D.loc.accuracy, [['low', T('Lav', 'Low')], ['balanced', T('Balansert', 'Balanced')], ['high', T('Høy', 'High')]])}</div>${ui.group(ui.row({ a: 'bg', icon: 'mdi:layers-outline', title: T('I bakgrunnen', 'In the background'), right: ui.sw(D.loc.background, 'bg') }))}`}
        ${ui.group(ui.row({ a: 'go', v: 'areas', icon: 'mdi:map-marker-radius-outline', title: T('Soner', 'Zones'), sub: T('Rediger sonene i Home Assistant', 'Edit zones in Home Assistant'), chev: true }))}`;
    },
    act(c, a, el) {
      if (a === 'seg') { if (el.dataset.f === 'mode') D.loc.mode = el.dataset.v; else D.loc.accuracy = el.dataset.v; save(); M.haptic('selection'); return c.render(); }
      if (a === 'bg') { D.loc.background = !D.loc.background; save(); M.haptic('selection'); return c.render(); }
      return undefined;
    },
  });
  M.ha.page('appnotif', {
    title: () => T('Varslingsinnstillinger', 'Notification settings'),
    render() {
      const r = (k, ic, t, s) => ui.row({ a: 'n', v: k, icon: ic, title: T(t), sub: s ? T(s) : '', right: ui.sw(!!D.notif[k], 'n', k) });
      return `${ui.group([r('push', 'mdi:bell-outline', 'Push-varsler', 'Fra automasjoner og skript'), r('sound', 'mdi:volume-high', 'Lyd'), r('critical', 'mdi:alert-octagon-outline', AND ? 'Alarmkanal' : 'Kritiske varsler', 'Bryter gjennom lydløs (røyk, vann, alarm)'), r('actions', 'mdi:gesture-tap-button', 'Handlinger i varsler', 'Knapper som Lås opp og Utsett')].join(''))}
        <div class="card"><p>${esc(T('Bruk denne handlingen i automasjoner:', 'Use this action in automations:'))}</p><pre class="pre" data-noi18n>action: notify.mobile_app_${esc(slug(D.device))}
data:
  title: Ringeklokke
  message: Noen ringte på
  data:
    actions:
      - action: LAAS_OPP
        title: Lås opp</pre></div>
        ${ui.group(ui.row({ a: 'go', v: 'notifs', icon: 'mdi:history', title: T('Varslingshistorikk', 'Notification history'), chev: true }))}`;
    },
    act(c, a, el) { if (a === 'n') { const k = el.dataset.v; D.notif[k] = !D.notif[k]; save(); M.haptic('selection'); return c.render(); } return undefined; },
  });
  M.ha.page('notifs', {
    title: () => T('Varsler', 'Notifications'), sub: () => T('Siste varsler til denne enheten', 'Recent notifications to this device'),
    right: () => `<button class="hb" data-a="clr" aria-label="${esc(T('Tøm', 'Clear'))}">${ui.ic('mdi:notification-clear-all', 20)}</button>`,
    render() {
      if (!D.history.length) return ui.empty('mdi:bell-sleep-outline', T('Ingen varsler', 'No notifications'));
      return D.history.map((n, i) => `<div class="card nt stg" style="animation-delay:${i * 35}ms"><div style="display:flex;gap:12px;align-items:flex-start"><span class="hi on">${ui.ic('mdi:home-assistant', 20)}</span><span class="ht"><b data-noi18n>${esc(n.title)}</b><i style="white-space:normal" data-noi18n>${esc(n.msg)}</i></span><span class="mut" style="flex:none">${esc(rel(n.t))}</span></div>${n.actions && n.actions.length && D.notif.actions ? `<div class="bts">${n.actions.map((x) => ui.btn(x, 'na', `${i}|${x}`, 'sm')).join('')}</div>` : ''}</div>`).join('');
    },
    act(c, a, el) {
      if (a === 'clr') { D.history = []; save(); M.haptic('medium'); return c.render(); }
      if (a === 'na') { const [i, x] = el.dataset.v.split('|'); log(`Varselhandling «${x}»`); M.haptic('success'); c.call('mobile_app', 'notification_action', { action: slug(x).toUpperCase() }).catch(() => {}); c.toast(`${x} – ${T('sendt til Home Assistant', 'sent to Home Assistant')}`); D.history.splice(Number(i), 1); save(); return c.render(); }
      return undefined;
    },
    reload: true,
  });
  const entRow = (h, id, a) => ui.row({ a, v: id, icon: (h.states[id] && h.states[id].attributes.icon) || (M.domainIcon ? M.domainIcon(id, h.states[id]) : 'mdi:shape'), title: (h.states[id] && h.states[id].attributes.friendly_name) || id, sub: id, right: `<button class="bt sm ic" data-a="${a}" data-v="${esc(id)}">${ui.ic('mdi:close', 16)}</button>` });
  const pick = (key, dom) => (M.entityPicker ? `<div class="fd">${M.entityPicker.html({ key, value: '', mode: 'add', domains: dom || '', placeholder: T('Legg til entitet', 'Add entity'), attrs: 'data-f="add"' })}</div>` : ui.field({ f: 'add', ph: 'light.stue', mono: true }));
  M.ha.page('appwidgets', {
    title: () => (AND ? T('Widgets og hurtigfliser', 'Widgets and quick tiles') : T('Widgets og snarveier', 'Widgets and shortcuts')),
    render(c) {
      const h = c.h, tab = c.state.tab || 'w', L = tab === 'w' ? D.widgets : D.tiles;
      return `${ui.seg('tab', tab, [['w', T('Widgets', 'Widgets')], ['t', AND ? T('Hurtigfliser', 'Quick tiles') : T('Snarveier', 'Shortcuts')]])}
        <p class="mut" style="margin:0 6px">${esc(tab === 'w' ? T('Entiteter som kan vises på hjemskjermen. Legg til widgeten fra hjemskjermen etterpå.', 'Entities available on the home screen. Add the widget from the home screen afterwards.') : AND ? T('Fliser i hurtiginnstillinger (sveip ned). Trykk slår av/på.', 'Tiles in quick settings. Tap toggles.') : T('Snarveier i Snarveier-appen og Siri.', 'Shortcuts in the Shortcuts app and Siri.'))}</p>
        ${L.length ? ui.group(L.map((id) => entRow(h, id, 'rm')).join('')) : ui.empty(tab === 'w' ? 'mdi:widgets-outline' : 'mdi:view-grid-plus-outline', T('Ingen ennå', 'None yet'))}${pick('wadd', 'light,switch,scene,script,lock,cover,climate,sensor,input_boolean,button')}`;
    },
    input(c, el, v) { if (el.dataset.f === 'add' && v) { const L = (c.state.tab || 'w') === 'w' ? D.widgets : D.tiles; if (!L.includes(v)) { L.push(v); save(); log('La til ' + v); M.haptic('success'); c.render(); } } },
    act(c, a, el) {
      if (a === 'seg') { c.state.tab = el.dataset.v; M.haptic('selection'); return c.render(); }
      if (a === 'rm') { const k = (c.state.tab || 'w') === 'w' ? 'widgets' : 'tiles'; D[k] = D[k].filter((x) => x !== el.dataset.v); save(); M.haptic('medium'); return c.render(); }
      return undefined;
    },
  });
  M.ha.page('appnfc', {
    title: () => T('NFC-brikker', 'NFC tags'),
    render(c) {
      const s = c.state, ok = 'NDEFReader' in window;
      return `<div class="card" style="align-items:center;text-align:center;padding:26px 18px"><span class="nfc ${s.busy ? 'on' : ''}">${ui.ic('mdi:nfc-variant', 40)}</span><b style="font-size:17px">${esc(s.busy ? T('Hold telefonen mot brikken …', 'Hold the phone to the tag …') : s.done ? T('Brikken er skrevet', 'Tag written') : T('Skriv en ny brikke', 'Write a new tag'))}</b><p>${esc(s.done ? `ID: ${s.done}` : T('Brikken får en ID som kan brukes som utløser i automasjoner.', 'The tag gets an ID you can use as an automation trigger.'))}</p></div>
        ${ui.field({ f: 'name', value: s.name || '', label: T('Navn på brikken', 'Tag name'), ph: T('F.eks. Inngangsdør', 'E.g. Front door') })}
        <div class="bts">${ui.btn(T('Skriv brikke', 'Write tag'), 'write', null, 'pri', 'mdi:pencil')}${ui.btn(T('Les brikke', 'Read tag'), 'read', null, '', 'mdi:nfc-search-variant')}</div>
        ${ok ? '' : `<p class="mut" style="margin:0 6px">${esc(T('NFC krever appen på telefonen. Her vises en demo.', 'NFC requires the phone app. This is a demo.'))}</p>`}
        ${ui.group(ui.row({ a: 'ext', v: '/config/tags', icon: 'mdi:tag-multiple-outline', title: T('Alle brikker i Home Assistant', 'All tags in Home Assistant'), ext: true }))}
        <style>.nfc{width:84px;height:84px;border-radius:42px;display:grid;place-items:center;background:var(--ki-surface-2,#404040);color:var(--orange,#f2b573)}.nfc.on{animation:nfcp 1.2s ease-in-out infinite}@keyframes nfcp{50%{box-shadow:0 0 0 14px rgb(242 181 115/.18)}}</style>`;
    },
    input(c, el, v) { if (el.dataset.f === 'name') c.state.name = v; },
    act(c, a) {
      const s = c.state;
      if (a === 'write' || a === 'read') {
        s.busy = true; s.done = null; c.render(); M.haptic('light');
        const id = a === 'write' ? (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)) : null;
        const fin = (tid) => { s.busy = false; s.done = tid; M.haptic('success'); log(`NFC ${a === 'write' ? 'skrevet' : 'lest'}: ${tid}`); if (a === 'write') c.ws('tag/create', { tag_id: tid, name: s.name || T('Brikke', 'Tag') }).catch(() => {}); else c.api('POST', `events/tag_scanned`, { tag_id: tid }).catch(() => {}); c.render(); };
        if ('NDEFReader' in window) { const r = new window.NDEFReader(); (a === 'write' ? r.write({ records: [{ recordType: 'url', data: `https://www.home-assistant.io/tag/${id}` }] }).then(() => fin(id)) : r.scan().then(() => { r.onreading = (e) => fin(e.serialNumber || 'ukjent'); })).catch((e) => { s.busy = false; c.err(e); c.render(); }); }
        else setTimeout(() => fin(id || 'demo-' + Date.now().toString(36).slice(-6)), 1400);
      }
      return undefined;
    },
  });
  M.ha.page('appwatch', {
    title: () => (AND ? 'Wear OS' : 'Apple Watch'), sub: () => T('Handlinger og komplikasjoner', 'Actions and complications'),
    render(c) { return `<p class="mut" style="margin:0 6px">${esc(T('Skript og scener du kan kjøre fra klokka.', 'Scripts and scenes you can run from the watch.'))}</p>${D.watch.length ? ui.group(D.watch.map((id) => entRow(c.h, id, 'rm')).join('')) : ui.empty('mdi:watch', T('Ingen handlinger ennå', 'No actions yet'))}${pick('wtadd', 'script,scene,light,switch,lock,cover,input_boolean')}`; },
    input(c, el, v) { if (el.dataset.f === 'add' && v && !D.watch.includes(v)) { D.watch.push(v); save(); M.haptic('success'); c.render(); } },
    act(c, a, el) { if (a === 'rm') { D.watch = D.watch.filter((x) => x !== el.dataset.v); save(); return c.render(); } return undefined; },
  });
  M.ha.page('applog', {
    title: () => T('Feilsøking', 'Troubleshooting'),
    render(c) {
      const h = c.h, cn = h && h.connection;
      return `<div class="card"><div class="kv"><span>${esc(T('Server', 'Server'))}</span><b data-noi18n>${esc(srv().name)}</b><span>${esc(T('Tilkobling', 'Connection'))}</span><b class="${cn && cn.connected === false ? 'err' : 'ok'}">${esc(cn && cn.connected === false ? T('Frakoblet', 'Disconnected') : T('Tilkoblet', 'Connected'))}</b><span>Home Assistant</span><b data-noi18n>${esc((h && h.config && h.config.version) || '–')}</b><span>KI MSH</span><b data-noi18n>${esc(window.KI_MSH_VERSION || '–')}</b><span>${esc(T('Plattform', 'Platform'))}</span><b>${AND ? 'Android' : 'iOS'}</b></div></div>
        <div class="bts">${ui.btn(T('Koble til på nytt', 'Reconnect'), 'rc', null, '', 'mdi:connection')}${ui.btn(T('Tøm cache', 'Clear cache'), 'cache', null, '', 'mdi:broom')}${ui.btn(T('Del logg', 'Share log'), 'share', null, '', 'mdi:share-variant')}</div>
        ${ui.sec(T('Logg', 'Log'))}${(D.log || []).length ? `<pre class="pre" data-noi18n>${esc(D.log.map((x) => `${new Date(x.t).toLocaleTimeString('nb-NO')}  ${x.m}`).join('\n'))}</pre>` : ui.empty('mdi:text-box-outline', T('Ingen hendelser ennå', 'No events yet'))}
        ${ui.group(ui.row({ a: 'onb', icon: 'mdi:restart', title: T('Kjør oppsettet på nytt', 'Run setup again'), sub: T('Velg server og logg inn på nytt', 'Pick server and log in again'), chev: true }))}`;
    },
    act(c, a) {
      if (a === 'rc') { log('Koblet til på nytt'); M.haptic('success'); return c.toast(T('Tilkoblet', 'Connected')); }
      if (a === 'cache') { try { caches && caches.keys().then((k) => k.forEach((x) => caches.delete(x))); } catch (e) {} log('Cache tømt'); M.haptic('medium'); return c.toast(T('Cachen er tømt', 'Cache cleared')); }
      if (a === 'share') { const t = (D.log || []).map((x) => `${new Date(x.t).toISOString()} ${x.m}`).join('\n'); if (navigator.share) return navigator.share({ title: 'KI MSH logg', text: t }).catch(() => {}); return navigator.clipboard && navigator.clipboard.writeText(t).then(() => c.toast(T('Kopiert', 'Copied'))); }
      if (a === 'onb') { c.close(); return window.parent && window.parent.postMessage({ kiOnboarding: true }, '*'); }
      return undefined;
    },
    reload: true,
  });

  // «Glimt AI»-raden: lukk innstillingene og åpne Glimt-innstillingene
  const P = M.ha.pages.hub, act0 = P.act;
  P.act = function (c, a, el, args) {
    if (a === 'tp') {
      const k = el && el.dataset ? el.dataset.v : args; c.close();
      setTimeout(() => {
        if (k === 'kiosk') { const nb = document.querySelector('msh-navbar-card'); return M.kioskSheet && M.kioskSheet(nb); }
        window.dispatchEvent(new CustomEvent('ki-open-editor', { detail: { editor: k === 'alt' ? 'tilpass-alt' : k } }));
      }, 320);
      return undefined;
    }
    if (a === 'glimt') { c.close(); setTimeout(() => { const g = window.kiGlimt; if (g) { g.view = 'set'; g.open(); } }, 320); return undefined; } return act0 ? act0.call(this, c, a, el, args) : undefined; };

  M.ha.appPages = true;
})();
