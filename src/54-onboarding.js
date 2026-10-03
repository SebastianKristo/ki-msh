/* Onboarding (første gang) og «Tilpass alt» (Fiks 23.7 · Onboarding.dc.html 1a / 1b).
 * Begge er fullskjerm-ark over dashbordet (MSH.overlay i ki-overlay-root, plassert mot dashbordflaten – aldri over
 * HA-sidebaren, fallgruve 1). Ikke Bubble-popups.
 *
 * ki-store (per HA-bruker, frontend/set_user_data «ki_dashboard»):
 *   onboarded: true            – satt ved «Hopp over», «Fullfør» og «Åpne dashbordet»
 *   onboard_known: [id …]      – rom/funksjoner som fantes da oppsettet ble fullført (nye senere → usjekket)
 *   reviewed: { <id>: true }   – «Tilpass alt» → sjekket (grønn hake / «Ser bra ut · neste»)
 *   review_at: <id>            – hvor gjennomgangen sist var (fortsetter der etter omlasting)
 * Alt annet skrives til SAMME config som de fulle arkene:
 *   personer i headeren / tittel / bildestørrelse / navn  → header_profiles (MSH.profileSet, som «Tilpass header»)
 *   rom med/uten                                         → popups.<area>.hidden (som «Tilpass Hjem» → Popups; strategien
 *                                                          lager ikke popupen, MSH.mergePopups hiddenBy 'user')
 *   romfarge                                             → rooms.<area>.look.col (som «Tilpass rom» → Romfarge)
 *   funksjon av                                          → popups.<key>.hidden (strategien lager ikke popupen);
 *                                                          Søppel (ingen egen popup) → Hjem-blokken skjules (cards.ki-home.hidden)
 *   navbar                                               → cards.<navbar card_id>.bar / more / hidden / buttons
 *   haptikk                                              → MSH.setHapticOff (nav_profiles, denne brukeren × enheten)
 *   kiosk / skjul sidebaren                              → kiosk.devices.<browser_mod-id> (53-kiosk.js)
 *   enhetsnavn                                           → MSH.store.setDeviceName
 * Alle tall kommer fra hass (områder, person.*, light.* …) og KI Rom (sensor.*_oversikt) – ingen eksempeldata.
 *
 * Når onboarding åpnes av seg selv (MSH.onboardMaybe, kalt fra msh-hjem-card):
 *   · ekte HA (<home-assistant> finnes) og dashbordet er strategien custom:ki-dashboard (MSH.strategyIsDashboard)
 *   · ki-store er lastet fra HA (MSH.store.loaded) og `onboarded` mangler for brukeren
 *   · ikke slått av med ?no-onboard i URL-en eller localStorage ki-no-onboard = '1'
 *   Testharnessen har ingen <home-assistant> → eksisterende tester blokkeres aldri. window.__kiOnboard = true tvinger
 *   sjekken på (test/onboarding-check.mjs).
 * Innganger til «Tilpass alt»: «Mer»-menyen (10-navbar, øverst blant verktøyene), lenke øverst i «Tilpass Hjem»
 * (27-hjem-editor), knapp i GUI-editoren til msh-hjem-card (25-hjem), og hendelsesbussen
 * ki-open-editor { editor: 'tilpass-alt' }. «Åpne «Tilpass X» ↗» går via ki-open-editor (home/navbar/header/room, og
 * her: 'card' { tag, card_id } for funksjons-popupenes egne ark, 'kiosk' for kiosk-arket).
 */
(function () {
  const M = window.MSH;
  if (!M || M.openOnboarding) return;
  const esc = M.esc;
  const PINK = 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';
  const GREEN = 'var(--green, #66d19e)';
  const COLS = ['var(--red)', 'var(--orange)', 'var(--yellow)', 'var(--lime)', 'var(--green)', 'var(--blue)', 'var(--light-blue)', 'var(--purple)', 'var(--pink)'];
  const ic = (n, s, st) => M.icon(n, s || 24, st || '');
  const hassNow = () => M.lastHass || ((document.querySelector('home-assistant') || {}).hass) || null;
  const S = () => M.store;
  const sget = (p) => (M.store ? M.store.get(p) : undefined);
  const put = (p, v) => (M.store ? M.store.set(p, v, { now: true }) : Promise.resolve({ ok: false }));
  const pl = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const col = (v) => M.color(v, v);
  const emit = (detail) => window.dispatchEvent(new CustomEvent('ki-open-editor', { detail }));

  /* ------------------------------------------------------------ data fra hass (autokonfig) */
  const cnt = (h, d, f) => M.all(h, d, f).length;
  const plat = (h, ...p) => Object.values((h && h.entities) || {}).filter((e) => p.includes(e.platform) && h.states[e.entity_id]).length;
  const rx = (h, re, doms) => Object.keys(h.states).filter((id) => (!doms || doms.includes(id.split('.')[0])) && (re.test(id) || re.test(String(h.states[id].attributes.friendly_name || '').toLowerCase()))).length;
  const kiRomN = (h) => Object.keys(h.states).filter((id) => id.startsWith('sensor.') && id.endsWith('_oversikt') && (h.states[id].attributes || {}).integrasjon === 'ki_rom').length;
  const posN = (h) => ['person', 'device_tracker'].reduce((s, d) => s + M.all(h, d).filter((id) => h.states[id].attributes.latitude != null).length, 0);
  // [nøkkel (= popup-hash uten #), navn, ikon, finn(h) → [antall, undertekst]]
  const FN = [
    ['lys', 'Lys', 'mdi:lightbulb-group', (h) => { const n = cnt(h, 'light'); return [n, pl(n, 'lys', 'lys')]; }],
    ['klima', 'Klima', 'mdi:thermostat', (h) => { const a = cnt(h, 'climate'), f = cnt(h, 'fan'); return [a + f, [a && pl(a, 'termostat', 'termostater'), f && pl(f, 'vifte', 'vifter')].filter(Boolean).join(' · ')]; }],
    ['media', 'Media', 'mdi:music-note', (h) => { const n = cnt(h, 'media_player'); return [n, pl(n, 'mediaspiller', 'mediaspillere')]; }],
    ['energi', 'Energi', 'mdi:lightning-bolt', (h) => { const n = cnt(h, 'sensor', (s) => ['energy', 'power', 'water'].includes(s.attributes.device_class)); return [n, pl(n, 'måler', 'målere')]; }],
    ['sikkerhet', 'Sikkerhet', 'mdi:shield-home', (h) => { const a = cnt(h, 'alarm_control_panel'), l = cnt(h, 'lock'); return [a + l, [a && pl(a, 'alarm', 'alarmer'), l && pl(l, 'lås', 'låser')].filter(Boolean).join(' · ')]; }],
    ['ruter', 'Ruter', 'mdi:tram', (h) => { const n = plat(h, 'entur', 'entur_public_transport', 'entur_sx'); return [n, pl(n, 'Entur-sensor', 'Entur-sensorer')]; }],
    ['kart', 'Kart', 'mdi:map', (h) => { const n = posN(h); return [n, pl(n, 'med posisjon', 'med posisjon')]; }],
    ['vanning', 'Vanning', 'mdi:sprinkler', (h) => { const n = Math.max(cnt(h, 'valve') + plat(h, 'opensprinkler'), rx(h, /vanning|sprinkler|drypp|irrigation/, ['switch', 'valve', 'input_boolean'])); return [n, pl(n, 'ventil/sone', 'ventiler/soner')]; }],
    ['soppel', 'Søppel', 'mdi:trash-can', (h) => { const id = M.hjemTrashAuto ? M.hjemTrashAuto(h) : null; return [id ? 1 : 0, id ? M.name(h, id) : '']; }],
  ];
  const FNK = FN.map((f) => f[0]);
  // Fiks 30.1: popup-nøkkel = standard-hashen uten # (alias-hasher via M.canonHash). Bassengpopupen er slettet – foreslås ikke.
  const pk = (k) => (M.canonHash ? M.canonHash('#' + k).slice(1) : k);
  const fnOf = (k) => FN.find((f) => f[0] === k) || FN.find((f) => pk(f[0]) === pk(k));
  const NAV_CAT = ['vanning', 'media', 'klima', 'ruter', 'gjoremal', 'kart', 'energi']; // navbarens innebygde knapper
  // områder med rom-popup (ikke «Basseng»/«Pool» – MSH.roomBlocked, bassengpopupen er slettet)
  const roomAreas = (h) => M.areas(h).filter((a) => !(M.roomBlocked && M.roomBlocked(h, a.id)));
  const areaDevs = (h, a) => { const D = Object.values((h && h.devices) || {}).filter((d) => d && d.area_id === a).length; return D || M.areaEntities(h, a).length; };

  /* ------------------------------------------------------------ config-oppslag (samme kilder som de fulle arkene) */
  const popCfg = (k) => sget('popups.' + pk(k)) || {};
  // = «Tilpass Hjem» → Popups (_popSet): tomme felt fjernes, tomt objekt slettes
  const popSet = (k, patch) => {
    const cur = { ...popCfg(k), ...patch };
    Object.keys(cur).forEach((x) => { if (cur[x] === undefined || cur[x] === null || cur[x] === false || cur[x] === '') delete cur[x]; });
    return put('popups.' + pk(k), Object.keys(cur).length ? cur : undefined);
  };
  const roomCol = (h, a) => sget('rooms.' + a + '.look.col') || popCfg(a).color || (M.romColor ? M.romColor(a, h) : 'var(--orange)');
  const roomColSet = (a, c) => { put('rooms.' + a + '.look.col', c); if (popCfg(a).color) popSet(a, { color: c }); };
  // Hjem (msh-hjem-card): cards.<card_id>
  const hjemId = () => { const l = M.liveOf && M.liveOf('msh-hjem-card'); return (l && l.config && l.config.card_id) || (M.CARD_IDS || {}).home || 'ki-home'; };
  const hjemCfg = () => { const l = M.liveOf && M.liveOf('msh-hjem-card'); return { ...((l && l.config) || {}), ...(M.store.card(hjemId()) || {}) }; };
  const hjemSet = (patch) => put('cards.' + hjemId(), { ...(M.store.card(hjemId()) || {}), ...patch });
  const soppelOn = () => !(hjemCfg().hidden || []).includes('soppel');
  const soppelSet = (on) => { const hid = (hjemCfg().hidden || []).filter((x) => x !== 'soppel'); if (!on) hid.push('soppel'); return hjemSet({ hidden: hid.length ? hid : undefined }); };
  const fnOn = (k) => (k === 'soppel' ? soppelOn() : !popCfg(k).hidden);
  const fnSet = (k, on) => (k === 'soppel' ? soppelSet(on) : popSet(k, { hidden: !on }));
  // Navbar: cards.<card_id> (effektiv = strategiens YAML + ki-store)
  const navLive = () => M.liveOf && M.liveOf('msh-navbar-card');
  const navId = () => { const l = navLive(); return (l && l.config && l.config.card_id) || (M.CARD_IDS || {}).navbar || 'ki-navbar'; };
  const navCfg = () => { const l = navLive(); return { ...((l && l.config) || {}), ...(M.store.card(navId()) || {}) }; };
  const navSet = (patch) => put('cards.' + navId(), { ...(M.store.card(navId()) || {}), ...patch });
  const navBar = () => { const c = navCfg(); return Array.isArray(c.bar) ? c.bar : ['vanning', 'media', 'klima', 'ruter']; };
  const navKnows = (k) => NAV_CAT.includes(k) || !!((navCfg().buttons || {})[k]);
  // Header: header_profiles (denne brukeren × enheten, som «Tilpass header»), ellers kortets config
  const HPROF = 'header_profiles';
  const hdrCfg = () => {
    const l = M.liveOf && M.liveOf('msh-hjem-header-card');
    const base = { ...((l && l.config) || {}), ...(M.store.card((l && l.config && l.config.card_id) || (M.CARD_IDS || {}).header || 'ki-home-header') || {}) };
    const P = M.hjemHeaderProfile ? M.hjemHeaderProfile() : {};
    return { base, P, mode: P.mode || base.mode || 'hilsen', size: P.size || base.size || 'M', show_name: P.show_name != null ? !!P.show_name : !!base.show_name };
  };
  const hdrSet = (patch) => (M.profileSet ? M.profileSet(HPROF, patch) : Promise.resolve());
  const hdrHidden = () => {
    const { base, P } = hdrCfg();
    if (Array.isArray(P.people_hidden)) return new Set(P.people_hidden);
    if (Array.isArray(base.people)) return new Set(base.people.filter((r) => r && r.hidden).map((r) => r.person));
    return new Set(base.hidden_persons || []);
  };
  const HDR_MODES = [['hilsen', 'Hilsen'], ['sted', 'Sted'], ['hjem', 'Vær']]; // ingen klokke-modus i headeren – «Hjem» = sted + vær
  const HDR_SIZES = [['S', 'Liten'], ['M', 'Middels'], ['L', 'Stor']];
  // Denne enheten: Browser Mod-ID (samme nøkkel som kiosk-arket)
  const bid = () => { try { return localStorage.getItem('browser_mod-browser-id') || null; } catch (e) { return null; } };
  const kdev = () => { const id = bid(); return id ? (((sget('kiosk') || {}).devices || {})[id] || null) : null; };
  const kioskState = () => { const d = kdev() || {}, h = d.on ? (d.hide || ['kiosk']) : []; return { kiosk: h.includes('kiosk'), sidebar: h.includes('kiosk') || h.includes('hide_sidebar') }; };
  const kioskWrite = (k, sb, name) => {
    const id = bid();
    if (!id) return;
    const cur = kdev() || {};
    let v;
    if (k) v = { ...cur, on: true, hide: ['kiosk'], when: cur.when || 'always' };
    else if (sb) v = { ...cur, on: true, hide: ['hide_sidebar'], when: 'always' };
    else v = { ...cur, on: false };
    v.name = v.name || name || id;
    if (JSON.stringify(v) !== JSON.stringify(cur)) put('kiosk.devices.' + id, v);
  };
  let bmName = null;
  const loadBmName = (h) => {
    const id = bid();
    if (!id || bmName != null || !h || !h.callWS) return Promise.resolve(bmName);
    return h.callWS({ type: 'config/device_registry/list' }).then((d) => {
      const x = (d || []).find((r) => (r.identifiers || []).some((p) => p[0] === 'browser_mod' && String(p[1]) === id));
      bmName = x ? (x.name_by_user || x.name || '') : '';
      return bmName;
    }, () => { bmName = ''; return bmName; });
  };
  const devName = () => { const n = sget('devices.' + (M.store && M.store.deviceId) + '.name'); return n || bmName || (M.store && M.store.deviceName) || ''; };
  const hapticOn = () => !(M.hapticOff && M.hapticOff());
  const picOf = (h, id) => { const a = (h.states[id] || {}).attributes || {}; const p = a.entity_picture; return p ? (M.hjemPicUrl ? M.hjemPicUrl(h, p) : p) : null; };
  const firstName = (s) => String(s || '').trim().split(/\s+/)[0] || '';

  /* ------------------------------------------------------------ felles CSS (fullskjerm-ark) */
  const CSS = `
    .sh{top:0;bottom:0;height:100%;max-height:none;border-radius:0 !important;--ki-sh-pt:0px;--ki-sh-px:0px;--ki-sh-pb:0px;padding:0}
    .bg{pointer-events:none}
    .body{display:flex;flex-direction:column;min-height:100%}
    button{border:0;background:none;color:inherit;font:inherit;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}
    input{font:inherit}
    .ob{flex:1;display:flex;flex-direction:column;box-sizing:border-box;min-height:100%;padding:calc(12px + env(safe-area-inset-top, 0px)) 18px 0;color:var(--ki-text, #fafafa);font-family:${M.FONT}}
    .top{display:flex;align-items:center;gap:12px;min-height:44px}
    .b44{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;background:var(--ki-sheet-grp,#3a3a3a);flex:none}
    .prog{flex:1;display:flex;gap:4px;min-width:0}
    .prog i{flex:1;height:4px;border-radius:2px;background:var(--ki-surface-2, var(--gray300,#404040))}
    .prog i.done{background:var(--ki-text-1, #e1e1e1)}.prog i.cur{background:${PINK}}
    .skip{height:44px;padding:0 6px;font-size:15px;font-weight:500;color:var(--ki-text-2, #afafaf);flex:none}
    h1{font-size:30px;line-height:1.1;font-weight:500;margin:22px 0 8px;letter-spacing:-0.01em}
    h2{font-size:26px;line-height:1.15;font-weight:500;margin:20px 0 6px}
    .lead{font-size:15px;line-height:1.4;color:var(--ki-text-2, #afafaf);margin:0 0 18px}
    .list{display:flex;flex-direction:column;gap:8px}
    .row{display:flex;align-items:center;gap:12px;min-height:64px;padding:10px 14px;border-radius:24px;background:var(--ki-sheet-grp,#3a3a3a);box-shadow:var(--ki-sheet-grp-sh,none);box-sizing:border-box;width:100%;text-align:left}
    .row .tt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .row .tt b{font-size:16px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .row .tt i{font-style:normal;font-size:13px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .row .tt i.red{color:var(--ki-red-text, var(--red,#f28073))}
    .row.off{opacity:.55}
    .ti{width:44px;height:44px;border-radius:22px;display:grid;place-items:center;flex:none}
    .av{width:44px;height:44px;border-radius:22px;flex:none;overflow:hidden;background:var(--ki-ctrl, #545454);display:grid;place-items:center;color:var(--ki-text, #232323);font-weight:600}
    .av img{width:100%;height:100%;object-fit:cover}
    .sw{position:relative;width:51px;height:31px;border-radius:16px;background:var(--ki-ctrl, var(--gray400,#545454));flex:none;transition:background .2s}
    .sw.on{background:${M.SWITCH_ON}}.sw i{position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:14px;background:var(--ki-knob, #fafafa);transition:left .2s;box-shadow:0 2px 4px rgb(0 0 0/max(var(--ki-ka-min,0),calc(.25*var(--ki-ka-k,1))))}.sw.on i{left:22px}
    .sw[disabled]{opacity:.4}
    .me{height:28px;padding:0 10px;border-radius:14px;background:var(--ki-surface-2, var(--gray300,#404040));color:var(--ki-text-2, #afafaf);font-size:12px;font-weight:600;flex:none}
    .me.on{background:${PINK};color:var(--ki-on-accent, #2a1720)}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .rc{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:10px;padding:14px;border-radius:24px;background:var(--ki-sheet-grp,#3a3a3a);min-height:124px;box-sizing:border-box;cursor:pointer;text-align:left}
    .rc.off{opacity:.5}
    .rc .ci{width:48px;height:48px;border-radius:24px;display:grid;place-items:center;color:var(--ki-on-accent, #232323)}
    .rc b{font-size:15px;font-weight:500;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .rc i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #979797);margin-top:-6px}
    .rc .ck{position:absolute;top:12px;right:12px;width:26px;height:26px;border-radius:13px;display:grid;place-items:center;background:var(--ki-surface-2, var(--gray300,#404040));color:var(--ki-text-2, #afafaf)}
    .rc .ck.on{background:${GREEN};color:var(--ki-on-accent, #232323)}
    .chips{display:flex;flex-wrap:wrap;gap:8px}
    .chip{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 14px 0 12px;border-radius:22px;background:var(--ki-sheet-grp,#3a3a3a);font-size:15px;font-weight:500}
    .chip.on{background:var(--ki-pill-bg, #e1e1e1);color:var(--ki-pill-fg, #232323)}
    .chip .num{min-width:22px;height:22px;border-radius:11px;background:var(--ki-bg, #232323);color:var(--ki-text, #fafafa);font-size:12px;display:grid;place-items:center;font-weight:600}
    .pv{margin:22px 0 4px;padding:26px 16px;border-radius:28px;background:var(--ki-bg, #232323);display:flex;justify-content:center}
    .pill{display:flex;align-items:center;justify-content:space-around;gap:4px;height:64px;width:min(100%,392px);padding:0 14px;box-sizing:border-box;border-radius:32px;background:var(--ki-surface, #fafafa);color:var(--ki-text, #232323);box-shadow:0 10px 30px rgb(0 0 0/max(var(--ki-ka-min,0),calc(.35*var(--ki-ka-k,1))))}
    .lbl{font-size:13px;color:var(--ki-text-mid, #979797);margin:18px 4px 8px}
    .seg{display:flex;padding:4px;gap:4px;border-radius:24px;background:var(--ki-sheet-seg,#232323)}
    .seg button{flex:1;height:40px;border-radius:20px;font-size:14px;font-weight:500;color:var(--ki-text-2, #afafaf)}
    .seg button.on{background:var(--ki-pill-bg, #e1e1e1);color:var(--ki-pill-fg, #232323)}
    .hp{border-radius:28px;background:var(--ki-bg, #232323);padding:20px 18px;display:flex;flex-direction:column;gap:14px}
    .hp .t{font-size:28px;font-weight:500;line-height:1.1}
    .hp .ps{display:flex;gap:10px;flex-wrap:wrap}
    .hp .p{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:12px;color:var(--ki-text-2, #afafaf)}
    .hp .p .av{background:var(--ki-ctrl, #696969)}
    .in{height:52px;border-radius:18px;border:0;padding:0 16px;background:var(--ki-sheet-in,#404040);color:var(--ki-text, #fafafa);font-size:16px;width:100%;box-sizing:border-box;outline:none}
    .note{font-size:13px;color:var(--ki-text-mid, #979797);padding:0 4px;margin-top:8px}
    .foot{position:sticky;bottom:0;margin:auto -18px 0;padding:14px 18px calc(16px + env(safe-area-inset-bottom, 0px));background:var(--ki-sheet-bg,#282828);-webkit-backdrop-filter:var(--ki-sheet-blur);backdrop-filter:var(--ki-sheet-blur);display:flex;flex-direction:column;gap:10px;z-index:3}
    .spacer{height:24px;flex:none}
    .main{height:56px;border-radius:28px;background:${PINK};color:var(--ki-on-accent, #2a1720);font-size:17px;font-weight:600;width:100%}
    .main[disabled]{opacity:.5}
    .ghost{height:48px;border-radius:24px;font-size:15px;font-weight:500;color:var(--ki-text-2, #afafaf);width:100%}
    .scan .row{min-height:56px}
    .scan .st{width:28px;height:28px;border-radius:14px;display:grid;place-items:center;flex:none;background:var(--ki-surface-2, var(--gray300,#404040));color:var(--ki-text-3, #7f7f7f)}
    .scan .st.ok{background:${GREEN};color:var(--ki-on-accent, #232323)}
    .scan .n{font-size:15px;font-weight:500;color:var(--ki-text-2, #afafaf)}
    .spin{width:14px;height:14px;border-radius:7px;border:2px solid var(--ki-text-3, #7f7f7f);border-top-color:transparent;animation:sp 0.8s linear infinite}
    @keyframes sp{to{transform:rotate(360deg)}}
    .big{width:88px;height:88px;border-radius:44px;display:grid;place-items:center;margin:40px auto 8px;background:${GREEN};color:var(--ki-on-accent, #232323)}
    .ctr{text-align:center}
    .chg{font-size:14px;font-weight:500;color:var(--ki-pink-text, #f285c9);flex:none;height:36px;padding:0 4px}
    .toastx{display:none}
  `;
  const sw = (on, a, extra) => `<button class="sw ${on ? 'on' : ''}" role="switch" aria-checked="${!!on}" data-a="${a}" ${extra || ''}><i></i></button>`;
  const fullSheet = (opts) => M.overlay({ html: '', css: CSS + (opts.css || ''), sheet: false, maxWidth: 600, tall: true, footer: true, bgHaptic: false, onClose: opts.onClose });

  /* ================================================================ Onboarding (1a) */
  let obOpen = null;
  M.openOnboarding = function ({ step } = {}) {
    if (obOpen && !obOpen.closed) return obOpen;
    const h0 = hassNow();
    if (!h0 || !M.store) return null;
    const o = { step: step != null ? step : 0, scan: 0, ret: null };
    obOpen = o;
    // Utkast fra dagens config (Kjør oppsettet på nytt = dagens valg)
    const init = () => {
      const h = hassNow(), hid = hdrHidden(), H = hdrCfg();
      o.persons = M.all(h, 'person').map((id) => ({ id, on: !hid.has(id) }));
      o.rooms = roomAreas(h).map((a) => ({ id: a.id, on: !popCfg(a.id).hidden, col: roomCol(h, a.id) }));
      o.fns = FN.map(([k]) => { const [n] = fnOf(k)[3](h); const stored = k === 'soppel' ? !soppelOn() : popCfg(k).hidden != null; return { k, on: stored ? fnOn(k) : n > 0 }; });
      const bar = navBar();
      o.nav = bar.filter((k) => o.fns.some((f) => f.k === k && f.on)).slice(0, 5);
      o.hdr = { mode: H.mode, size: H.size, show_name: H.show_name };
      const K = kioskState();
      o.dev = { name: devName(), haptic: hapticOn(), kiosk: K.kiosk, sidebar: K.sidebar };
    };
    init();
    loadBmName(h0).then(() => { if (!o.dev.name) o.dev.name = devName(); upd(); });
    const ov = fullSheet({ onClose: () => { clearInterval(o.timer); if (obOpen === o) obOpen = null; } });
    o.ov = ov;
    Object.defineProperty(o, 'closed', { get: () => ov.closed });

    const render = () => {
      const h = hassNow();
      if (!h) return '<div class="ob"><p class="lead">Venter på Home Assistant …</p></div>';
      const s = o.step;
      if (s === 0) return step0(h);
      if (s === 7) return step7(h);
      const segs = Array.from({ length: 6 }, (_, i) => `<i class="${i + 1 < s ? 'done' : i + 1 === s ? 'cur' : ''}"></i>`).join('');
      const body = [null, step1, step2, step3, step4, step5, step6][s](h);
      return `<div class="ob" data-key="ob-${s}">
        <div class="top"><button class="b44" data-a="back" aria-label="Tilbake">${ic('mdi:chevron-left', 26)}</button><div class="prog" aria-label="Steg ${s} av 6">${segs}</div><button class="skip" data-a="skip">Hopp over</button></div>
        ${body}
        <div class="spacer"></div>
        <div class="foot"><button class="main" data-a="next" data-key="next">${s === 6 ? 'Fullfør' : o.ret ? 'Ferdig' : 'Neste'}</button></div>
      </div>`;
    };
    const SCAN = [
      ['Områder', 'mdi:texture-box', (h) => M.areas(h).length],
      ['Personer', 'mdi:account-multiple', (h) => cnt(h, 'person')],
      ['Lys', 'mdi:lightbulb', (h) => cnt(h, 'light')],
      ['Mediaspillere', 'mdi:speaker', (h) => cnt(h, 'media_player')],
      ['Termostater', 'mdi:thermostat', (h) => cnt(h, 'climate')],
      ['Sensorer', 'mdi:eye', (h) => cnt(h, 'sensor')],
      ['KI Rom-integrasjon', 'mdi:home-analytics', (h) => kiRomN(h)],
    ];
    const step0 = (h) => {
      const nm = firstName((h.user && h.user.name) || '');
      const rows = SCAN.map(([l, icn, f], i) => {
        const done = i < o.scan, n = done ? f(h) : null;
        const val = !done ? '' : i === SCAN.length - 1 ? (n ? pl(n, 'rom', 'rom') : 'Ikke funnet') : String(n);
        return `<div class="row" data-key="sc-${i}"><span class="ti" style="background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))">${ic(icn, 22, 'color:var(--ki-text-2, #afafaf)')}</span><span class="tt"><b>${esc(l)}</b></span><span class="n">${esc(val)}</span><span class="st ${done ? 'ok' : ''}">${done ? ic('mdi:check', 18) : i === o.scan ? '<span class="spin"></span>' : ''}</span></div>`;
      }).join('');
      const ready = o.scan >= SCAN.length;
      return `<div class="ob" data-key="ob-0">
        <h1 style="margin-top:36px">Hei${nm ? ', ' + esc(nm) : ''}.</h1>
        <p class="lead">${ready ? 'Dette fant jeg i Home Assistant. Oppsettet bekrefter det som ble funnet – du retter bare det som er feil.' : 'Jeg ser gjennom Home Assistant og setter opp dashbordet …'}</p>
        <div class="list scan">${rows}</div>
        <div class="spacer"></div>
        <div class="foot"><button class="main" data-a="start" data-key="start">Start oppsett</button><button class="ghost" data-a="std" data-key="std">Bruk standard og hopp over</button></div>
      </div>`;
    };
    const step1 = (h) => {
      const me = h.user && h.user.id;
      const rows = o.persons.map((p) => {
        const a = (h.states[p.id] || {}).attributes || {}, nm = a.friendly_name || p.id, pic = picOf(h, p.id), isMe = !!(me && a.user_id === me);
        return `<div class="row ${p.on ? '' : 'off'}" data-key="p-${esc(p.id)}"><span class="av">${pic ? `<img src="${esc(pic)}" alt="">` : esc(nm.charAt(0).toUpperCase())}</span>
          <span class="tt"><b>${esc(nm)}</b><i>${esc(p.id)} · ${p.on ? 'vises' : 'skjult'}</i></span>
          <button class="me ${isMe ? 'on' : ''}" data-a="me" data-v="${esc(p.id)}" title="Knytt til HA-brukeren din">Meg</button>${sw(p.on, 'pvis', `data-v="${esc(p.id)}"`)}</div>`;
      }).join('');
      return `<h2>Hvem bor her?</h2><p class="lead">${o.persons.length ? `Fant ${pl(o.persons.length, 'person', 'personer')} i Home Assistant. Velg hvem som vises i headeren, og hvem som er deg.` : 'Fant ingen person.* i Home Assistant. Legg til personer under Innstillinger → Personer.'}</p><div class="list">${rows}</div>`;
    };
    const step2 = (h) => {
      const A = M.areas(h);
      const cards = o.rooms.map((r) => {
        const a = A.find((x) => x.id === r.id) || {}, au = M.roomAuto ? M.roomAuto(h, r.id) : {}, icon = popCfg(r.id).icon || sget('rooms.' + r.id + '.look.icon') || a.icon || (au && au.A && au.A.ikon) || 'mdi:home';
        return `<div class="rc ${r.on ? '' : 'off'}" data-a="rtog" data-v="${esc(r.id)}" data-key="r-${esc(r.id)}" role="button"><button class="ci" data-a="rcol" data-v="${esc(r.id)}" style="background:${col(r.col)}" aria-label="Bytt farge">${ic(icon, 24)}</button>
          <b>${esc(a.name || r.id)}</b><i>${esc(pl(areaDevs(h, r.id), 'enhet', 'enheter'))}</i><span class="ck ${r.on ? 'on' : ''}">${ic(r.on ? 'mdi:check' : 'mdi:plus', 18)}</span></div>`;
      }).join('');
      const on = o.rooms.filter((r) => r.on).length;
      return `<h2>Rom</h2><p class="lead">${o.rooms.length ? `${pl(o.rooms.length, 'område', 'områder')} i Home Assistant · ${on} med. Trykk på et rom for å ta det med eller fjerne det, og på sirkelen for å bytte farge.` : 'Fant ingen områder i Home Assistant.'}</p><div class="grid">${cards}</div>`;
    };
    const step3 = (h) => {
      const rows = o.fns.map((f) => {
        const [k, l, icn, fd] = fnOf(f.k), [n, sub] = fd(h);
        return `<button class="row ${f.on ? '' : 'off'}" data-a="ftog" data-v="${k}" data-key="f-${k}"><span class="ti" style="background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)))">${ic(icn, 22)}</span>
          <span class="tt"><b>${esc(l)}</b>${n ? `<i>${esc(sub)}</i>` : '<i class="red">Ingen entiteter funnet · velg senere</i>'}</span>${sw(f.on, 'ftog', `data-v="${k}" tabindex="-1"`)}</button>`;
      }).join('');
      return `<h2>Funksjoner</h2><p class="lead">Popupene som lages. Av betyr at dashbordet ikke lager popupen.</p><div class="list">${rows}</div>`;
    };
    const navChoices = () => o.fns.filter((f) => f.on && f.k !== 'soppel').map((f) => f.k);
    const step4 = () => {
      const ch = navChoices();
      o.nav = o.nav.filter((k) => ch.includes(k));
      const chips = ch.map((k) => { const [, l, icn] = fnOf(k), i = o.nav.indexOf(k); return `<button class="chip ${i >= 0 ? 'on' : ''}" data-a="nav" data-v="${k}" data-key="n-${k}">${ic(icn, 20)}${esc(l)}${i >= 0 ? `<span class="num">${i + 1}</span>` : ''}</button>`; }).join('');
      const pill = o.nav.map((k) => ic(fnOf(k)[2], 26)).join('') + ic('mdi:dots-horizontal', 26);
      return `<h2>Navbar</h2><p class="lead">Velg opptil fem knapper. Nummeret viser rekkefølgen – resten ligger i «Mer».</p>
        <div class="chips">${chips || '<span class="note">Ingen funksjoner er slått på.</span>'}</div>
        <div class="pv" data-key="navpv"><div class="pill">${pill}</div></div>`;
    };
    const step5 = (h) => {
      const P = o.persons.filter((p) => p.on), n = { S: 40, M: 55, L: 64 }[o.hdr.size] || 55, hr = new Date().getHours();
      const nm = firstName((h.user && h.user.name) || '');
      let t;
      if (o.hdr.mode === 'hilsen') t = `${hr < 5 ? 'God natt' : hr < 10 ? 'God morgen' : hr < 18 ? 'God dag' : 'God kveld'}${nm ? ', ' + esc(nm) : ''}`;
      else if (o.hdr.mode === 'sted') t = esc((h.config && h.config.location_name) || 'Hjem');
      else { const w = M.all(h, 'weather')[0], s = w && h.states[w]; t = s ? `${esc(M.nf ? M.nf(s.attributes.temperature, 0) : Math.round(s.attributes.temperature))}° · ${esc(M.hjemCond ? M.hjemCond(s.state) : s.state)}` : '– · Velg entitet'; }
      const faces = P.map((p) => { const a = (h.states[p.id] || {}).attributes || {}, pic = picOf(h, p.id), nm2 = a.friendly_name || p.id; return `<span class="p"><span class="av" style="width:${n}px;height:${n}px;border-radius:${n / 2}px">${pic ? `<img src="${esc(pic)}" alt="">` : esc(nm2.charAt(0).toUpperCase())}</span>${o.hdr.show_name ? esc(firstName(nm2)) : ''}</span>`; }).join('');
      const seg = (a, list, v) => `<div class="seg" data-key="seg-${a}">${list.map(([k, l]) => `<button class="${v === k ? 'on' : ''}" data-a="${a}" data-v="${k}">${esc(l)}</button>`).join('')}</div>`;
      return `<h2>Header</h2><p class="lead">Øverst på Hjem. Du kan finjustere alt i «Tilpass header».</p>
        <div class="hp" data-key="hp"><div class="t">${t}</div><div class="ps">${faces || '<span class="note">Ingen personer vises</span>'}</div></div>
        <div class="lbl">Tittel</div>${seg('hmode', HDR_MODES, o.hdr.mode)}
        <div class="lbl">Personbilder</div>${seg('hsize', HDR_SIZES, o.hdr.size)}
        <div class="lbl"></div><div class="row"><span class="tt"><b>Vis navn under bildene</b></span>${sw(o.hdr.show_name, 'hname')}</div>`;
    };
    const step6 = () => {
      const id = bid();
      return `<h2>Denne enheten</h2><p class="lead">Gjelder bare denne nettleseren${id ? ` (Browser Mod ${esc(id)})` : ''}.</p>
        <div class="lbl">Enhetsnavn</div><input class="in" data-in="dname" data-key="dname" value="${esc(o.dev.name)}" placeholder="${esc(bmName || M.deviceInfo().label)}">
        <div class="lbl"></div>
        <div class="list">
          <div class="row"><span class="ti" style="background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)))">${ic('mdi:vibrate', 22)}</span><span class="tt"><b>Haptikk</b><i>Vibrasjon ved trykk</i></span>${sw(o.dev.haptic, 'dhap')}</div>
          <div class="row"><span class="ti" style="background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)))">${ic('mdi:fullscreen', 22)}</span><span class="tt"><b>Kiosk-modus</b><i>${id ? 'Skjuler HA-grensesnittet på denne enheten' : 'Krever Browser Mod'}</i></span>${sw(o.dev.kiosk, 'dkiosk', id ? '' : 'disabled')}</div>
          <div class="row"><span class="ti" style="background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)))">${ic('mdi:dock-left', 22)}</span><span class="tt"><b>Skjul HA-sidebaren</b><i>${id ? (o.dev.kiosk ? 'Skjult av kiosk-modus' : 'Bare sidemenyen') : 'Krever Browser Mod'}</i></span>${sw(o.dev.sidebar || o.dev.kiosk, 'dside', id && !o.dev.kiosk ? '' : 'disabled')}</div>
        </div>`;
    };
    const step7 = (h) => {
      const P = o.persons.filter((p) => p.on), me = M.all(h, 'person').find((id) => h.user && (h.states[id].attributes || {}).user_id === h.user.id);
      const R = o.rooms.filter((r) => r.on), F = o.fns.filter((f) => f.on);
      const navL = o.nav.map((k) => fnOf(k)[1]);
      const rows = [
        [1, 'mdi:account-multiple', 'Personer', `${pl(P.length, 'i headeren', 'i headeren')}${me ? ' · Meg: ' + firstName(M.name(h, me)) : ''}`],
        [2, 'mdi:texture-box', 'Rom', `${R.length} av ${o.rooms.length} rom`],
        [3, 'mdi:apps', 'Funksjoner', `${F.length} på · ${F.map((f) => fnOf(f.k)[1]).slice(0, 4).join(', ')}${F.length > 4 ? ' …' : ''}`],
        [4, 'mdi:dock-bottom', 'Navbar', navL.length ? navL.join(' · ') + ' + Mer' : 'Bare «Mer»'],
        [6, 'mdi:cellphone', 'Enhet', `${o.dev.name || 'Denne enheten'} · haptikk ${o.dev.haptic ? 'på' : 'av'}${o.dev.kiosk ? ' · kiosk' : ''}`],
      ].map(([st, icn, l, sub]) => `<div class="row" data-key="sum-${st}"><span class="ti" style="background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)))">${ic(icn, 22)}</span><span class="tt"><b>${esc(l)}</b><i>${esc(sub)}</i></span><button class="chg" data-a="goto" data-v="${st}">Endre ›</button></div>`).join('');
      return `<div class="ob" data-key="ob-7">
        <div class="big">${ic('mdi:check', 48)}</div>
        <h1 class="ctr" style="margin-top:12px">Dashbordet er klart.</h1>
        <p class="lead ctr">Alt kan endres senere i «Tilpass alt» i «Mer»-menyen.</p>
        <div class="list">${rows}</div>
        <div class="spacer"></div>
        <div class="foot"><button class="main" data-a="open" data-key="open">Åpne dashbordet</button></div>
      </div>`;
    };
    const upd = () => { if (!ov.closed) M.morph(ov.body, render()); };
    o.render = upd;

    /* ---------- lagring per steg (når man går videre) */
    const save = (s) => {
      const h = hassNow();
      try {
        if (s === 1) {
          const hid = o.persons.filter((p) => !p.on).map((p) => p.id), cur = [...hdrHidden()];
          if (JSON.stringify([...hid].sort()) !== JSON.stringify(cur.sort())) hdrSet({ people_hidden: hid });
        } else if (s === 2) {
          o.rooms.forEach((r) => {
            if (!!popCfg(r.id).hidden !== !r.on) popSet(r.id, { hidden: !r.on });
            if (r.col !== roomCol(h, r.id)) roomColSet(r.id, r.col);
          });
        } else if (s === 3) {
          o.fns.forEach((f) => { if (f.k === 'soppel' ? soppelOn() !== f.on : !!popCfg(f.k).hidden !== !f.on) fnSet(f.k, f.on); });
          // navbaren peker ikke på popups som ikke lages
          const N = navCfg(), hidden = new Set(Array.isArray(N.hidden) ? N.hidden : []);
          o.fns.forEach((f) => { if (f.k === 'soppel') return; if (f.on) hidden.delete(f.k); else if (navKnows(f.k)) hidden.add(f.k); });
          const nh = [...hidden];
          if (JSON.stringify(nh) !== JSON.stringify(N.hidden || [])) navSet({ hidden: nh.length ? nh : undefined });
        } else if (s === 4) {
          const N = navCfg(), B = { ...(N.buttons || {}) }, on = navChoices();
          // funksjoner uten innebygd navbar-knapp (Lys, Sikkerhet) får en egen knapp til popupen
          on.forEach((k) => { if (!NAV_CAT.includes(k) && !B[k]) { const [, l, icn] = fnOf(k); B[k] = { custom: true, icon: icn, label: l, tap: { action: 'navigate', navigation_path: '#' + k } }; } });
          const bar = o.nav.slice(0, 5);
          const prevMore = Array.isArray(N.more) ? N.more : [];
          const more = [...on.filter((k) => !bar.includes(k)), ...prevMore.filter((k) => !bar.includes(k) && !FNK.includes(k))].filter((k, i, a) => a.indexOf(k) === i);
          const hidden = (Array.isArray(N.hidden) ? N.hidden : []).filter((k) => !on.includes(k));
          navSet({ bar, more, hidden: hidden.length ? hidden : undefined, buttons: Object.keys(B).length ? B : undefined });
        } else if (s === 5) {
          const H = hdrCfg(), p = {};
          ['mode', 'size', 'show_name'].forEach((k) => { if (o.hdr[k] !== H[k]) p[k] = o.hdr[k]; });
          if (Object.keys(p).length) hdrSet(p);
        } else if (s === 6) {
          const nm = String(o.dev.name || '').trim();
          if (nm && nm !== devName() && M.store.setDeviceName) M.store.setDeviceName(nm);
          if (o.dev.haptic !== hapticOn() && M.setHapticOff) M.setHapticOff(!o.dev.haptic);
          const K = kioskState();
          if (K.kiosk !== o.dev.kiosk || K.sidebar !== (o.dev.sidebar || o.dev.kiosk)) kioskWrite(o.dev.kiosk, o.dev.sidebar, nm);
        }
      } catch (e) { console.error('[ki-msh] onboarding steg ' + s, e); }
    };
    const known = () => { const h = hassNow(); return [...new Set([...roomAreas(h).map((a) => 'rom:' + a.id), ...FNK.map((k) => 'fn:' + k), ...fnList(h).map((f) => 'fn:' + f.key)])]; };
    const finish = () => {
      put('onboarded', true);
      put('onboard_known', known());
      try { if (M.refreshPopups) M.refreshPopups(hassNow()); } catch (e) { /* */ } // strategien bygger på nytt
    };
    const go = (s) => { o.step = s; o.scrollTop(); upd(); };
    o.scrollTop = () => { const sh = ov.root.querySelector('.sh'); if (sh) sh.scrollTop = 0; };

    ov.root.addEventListener('input', (e) => { const t = e.target; if (t && t.dataset && t.dataset.in === 'dname') o.dev.name = t.value; });
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]');
      if (!el || el.disabled) return;
      const a = el.dataset.a, v = el.dataset.v, h = hassNow();
      switch (a) {
        case 'start': M.haptic('light'); return go(1);
        case 'std': M.haptic('success'); finish(); return go(7);
        case 'skip': M.haptic('light'); finish(); return go(7);
        case 'back': M.haptic('light'); if (o.ret) { const r = o.ret; o.ret = null; return go(r); } return go(Math.max(0, o.step - 1));
        case 'next': {
          save(o.step);
          if (o.step === 6) { M.haptic('success'); finish(); o.ret = null; return go(7); }
          M.haptic('light');
          if (o.ret) { const r = o.ret; o.ret = null; if (r === 7) finish(); return go(r); }
          return go(o.step + 1);
        }
        case 'goto': M.haptic('light'); o.ret = 7; return go(Number(v));
        case 'open': M.haptic('success'); finish(); return ov.close();
        case 'pvis': { M.haptic('selection'); const p = o.persons.find((x) => x.id === v); if (p) p.on = !p.on; return upd(); }
        case 'me': {
          M.haptic('selection');
          const u = h && h.user;
          if (!u || !u.is_admin) { M.toast('Krever administrator'); return; }
          const a2 = (h.states[v] || {}).attributes || {};
          if (a2.user_id === u.id) return;
          if (!a2.id) { M.toast('Personen kan ikke endres her'); return; }
          const prev = M.all(h, 'person').find((id) => (h.states[id].attributes || {}).user_id === u.id);
          const pa = prev && h.states[prev].attributes;
          Promise.resolve(pa && pa.id ? h.callWS({ type: 'person/update', person_id: pa.id, user_id: null }) : null)
            .then(() => h.callWS({ type: 'person/update', person_id: a2.id, user_id: u.id }))
            .then(() => M.toast(`${firstName(a2.friendly_name || v)} er deg`), (err) => M.toast('Kunne ikke knytte personen' + (err && err.message ? ' – ' + err.message : '')));
          return;
        }
        case 'rtog': { M.haptic('selection'); const r = o.rooms.find((x) => x.id === v); if (r) r.on = !r.on; return upd(); }
        case 'rcol': {
          M.haptic('selection');
          const r = o.rooms.find((x) => x.id === v);
          if (r) { const i = COLS.indexOf(r.col); r.col = COLS[(i + 1) % COLS.length]; }
          return upd();
        }
        case 'ftog': { M.haptic('selection'); const f = o.fns.find((x) => x.k === v); if (f) f.on = !f.on; return upd(); }
        case 'nav': {
          const i = o.nav.indexOf(v);
          if (i >= 0) { M.haptic('selection'); o.nav.splice(i, 1); return upd(); }
          if (o.nav.length >= 5) { M.haptic('warning'); M.toast('Maks fem · resten ligger i «Mer»'); return; }
          M.haptic('selection'); o.nav.push(v); return upd();
        }
        case 'hmode': M.haptic('selection'); o.hdr.mode = v; return upd();
        case 'hsize': M.haptic('selection'); o.hdr.size = v; return upd();
        case 'hname': M.haptic('selection'); o.hdr.show_name = !o.hdr.show_name; return upd();
        case 'dhap': o.dev.haptic = !o.dev.haptic; if (o.dev.haptic) { if (M.setHapticOff) M.setHapticOff(false); M.haptic('medium'); } return upd();
        case 'dkiosk': M.haptic('selection'); o.dev.kiosk = !o.dev.kiosk; return upd();
        case 'dside': M.haptic('selection'); o.dev.sidebar = !o.dev.sidebar; return upd();
        default:
      }
    });
    upd();
    if (o.step === 0) {
      o.timer = setInterval(() => { if (ov.closed || o.scan >= SCAN.length) { clearInterval(o.timer); return; } o.scan++; if (o.step === 0) upd(); }, 320);
    }
    return o;
  };

  // Første gang: kalles av msh-hjem-card ved hver hass (billig – sjekker bare én gang per side)
  let obTried = false;
  const obAllowed = () => {
    try {
      if (/[?&]no-onboard\b/.test(location.search) || localStorage.getItem('ki-no-onboard') === '1') return false;
    } catch (e) { /* */ }
    if (window.__kiOnboard === true) return true;
    return !!document.querySelector('home-assistant') && !!M.strategyIsDashboard;
  };
  M.onboardMaybe = function (hass) {
    if (obTried || !hass || !M.store || !obAllowed()) return;
    obTried = true;
    Promise.resolve(M.store.load(hass)).then(() => {
      if (!M.store.loaded || M.store.get('onboarded')) return;
      setTimeout(() => { if (!M.store.get('onboarded') && obAllowed()) M.openOnboarding({ step: 0 }); }, 500);
    });
  };

  /* ================================================================ Tilpass alt (1b) */
  const GROUPS = [['dash', 'Dashbord'], ['rom', 'Rom'], ['fn', 'Funksjoner'], ['enh', 'Enheter'], ['adv', 'Avansert']];
  const GL = Object.fromEntries(GROUPS);
  const toggle = (label, get, set) => ({ type: 'toggle', label, get, set });
  const segQ = (label, opts, get, set) => ({ type: 'seg', label, opts, get, set });
  // Aktive funksjons-popups: fra siste strategi-generering (MSH.popupReport), ellers etter entitetene
  const fnList = (h) => {
    const rep = M.popupReport && Array.isArray(M.popupReport.entries) ? M.popupReport.entries : null;
    const FP = M.FUNCTION_POPUPS || [];
    if (rep) {
      return rep.filter((e) => e.group === 'fn' && !e.person && e.key !== 'settings' && FP.some((f) => f[0] === e.hash)).map((e) => { const f = FP.find((x) => x[0] === e.hash); return { key: e.key, name: f[1], icon: f[2], tag: f[3] }; });
    }
    return FP.filter(([hash]) => { const k = hash.slice(1), d = fnOf(k); return popCfg(k).hidden || (d ? d[3](h)[0] > 0 : true); }).map(([hash, name, icon, tag]) => ({ key: hash.slice(1), name, icon, tag }));
  };
  const entStats = () => {
    const out = [], D = (M.store && M.store.view ? M.store.view() : sget()) || {};
    const scan = (grp, obj) => Object.keys(obj || {}).forEach((id) => {
      const c = obj[id] || {}, n = (x) => (Array.isArray(x) ? x.length : x && typeof x === 'object' ? Object.keys(x).length : 0);
      const o = n(c.overrides), ex = n(c.exclude), inc = n(c.include);
      if (o || ex || inc) out.push({ grp, id, o, ex, inc });
    });
    scan('cards', D.cards); scan('rooms', D.rooms);
    return out;
  };
  const items = (h) => {
    const L = [];
    const hj = hjemCfg(), N = navCfg(), Hd = hdrCfg();
    const hidP = hdrHidden(), nP = M.all(h, 'person').filter((id) => !hidP.has(id)).length;
    L.push({ id: 'hjem', g: 'dash', icon: 'mdi:view-dashboard', color: 'var(--pink)', title: 'Hjem', sub: `${hj.show_todo === false ? 'Uten gjøremål' : 'Med gjøremål'} · layout ${({ auto: 'auto', mobil: 'mobil', stor: 'stor skjerm' })[hj.layout_mode || 'auto']}`,
      desc: 'Kortene, fanene og popupene på Hjem.', open: { label: 'Tilpass Hjem', ev: { editor: 'home' } },
      q: [toggle('Vis gjøremål', () => hjemCfg().show_todo !== false, (v) => hjemSet({ show_todo: v ? undefined : false })),
        segQ('Layout', [['auto', 'Auto'], ['mobil', 'Mobil'], ['stor', 'Stor']], () => hjemCfg().layout_mode || 'auto', (v) => hjemSet({ layout_mode: v === 'auto' ? undefined : v }))] });
    L.push({ id: 'header', g: 'dash', icon: 'mdi:page-layout-header', color: 'var(--blue)', title: 'Header', sub: `${(HDR_MODES.find((x) => x[0] === Hd.mode) || [0, Hd.mode])[1]} · ${pl(nP, 'person', 'personer')}${Hd.show_name ? ' · navn under' : ''}`,
      desc: 'Hilsen, vær og personbildene øverst på Hjem. Gjelder denne brukeren på denne enhetstypen.', open: { label: 'Tilpass header', ev: { editor: 'header' } },
      q: [segQ('Tittel', HDR_MODES, () => hdrCfg().mode, (v) => hdrSet({ mode: v })),
        segQ('Personbilder', HDR_SIZES, () => hdrCfg().size, (v) => hdrSet({ size: v })),
        toggle('Vis navn under bildene', () => hdrCfg().show_name, (v) => hdrSet({ show_name: v }))] });
    const bar = navBar(), K = kioskState();
    L.push({ id: 'navbar', g: 'dash', icon: 'mdi:dock-bottom', color: 'var(--green)', title: 'Navbar', sub: `${pl(bar.length, 'knapp', 'knapper')} · Mer-meny${N.style === 'glass' ? ' · Liquid Glass' : ''}${K.kiosk ? ' · kiosk' : ''}`,
      desc: 'Knappene i navbaren, «Mer»-menyen, merker og mini-spilleren.', open: { label: 'Tilpass navbar', ev: { editor: 'navbar' } },
      q: [toggle('Vis navn under ikonene', () => !!navCfg().show_names, (v) => navSet({ show_names: v })),
        segQ('Stil', [['white', 'Standard'], ['glass', 'Liquid Glass']], () => navCfg().style || 'white', (v) => navSet({ style: v })),
        segQ('Layout', [['auto', 'Auto'], ['mobil', 'Mobil'], ['stor', 'Stor']], () => navCfg().layout || 'auto', (v) => navSet({ layout: v }))] });
    L.push({ id: 'tema', g: 'dash', icon: 'mdi:palette', color: 'var(--purple)', title: 'Tema og farger', sub: `Liquid Glass ${M.glassOn && M.glassOn() ? 'på' : 'av'} · animasjon ${M.glassAnimOn && M.glassAnimOn() ? 'på' : 'av'}`,
      desc: 'Utseendet på alle Tilpass-ark og glass-animasjonen i faner og segmenter.', open: { label: 'Tilpass Hjem', ev: { editor: 'home', focus: 'faner' } },
      q: [toggle('Liquid Glass-ark', () => !!(M.glassOn && M.glassOn()), (v) => M.setGlassTheme && M.setGlassTheme(v)),
        toggle('Liquid Glass-animasjon', () => !!(M.glassAnimOn && M.glassAnimOn()), (v) => M.setGlassAnim && M.setGlassAnim(v))] });
    roomAreas(h).forEach((a) => {
      const hid = !!popCfg(a.id).hidden, c = roomCol(h, a.id);
      L.push({ id: 'rom:' + a.id, g: 'rom', icon: popCfg(a.id).icon || a.icon || 'mdi:home', color: c, title: a.name, sub: `${pl(areaDevs(h, a.id), 'enhet', 'enheter')} · ${hid ? 'skjult' : 'popup #' + a.id}`,
        desc: `Rom-popupen #${a.id}: klima-toppkort, lys, media og scener fra området.`, open: { label: 'Tilpass rom', ev: { editor: 'room', area: a.id } },
        q: [toggle('Vis rommet', () => !popCfg(a.id).hidden, (v) => popSet(a.id, { hidden: !v })),
          { type: 'colors', label: 'Romfarge', get: () => roomCol(hassNow(), a.id), set: (v) => roomColSet(a.id, v) }] });
    });
    fnList(h).forEach((f) => {
      const hid = !!popCfg(f.key).hidden, d = fnOf(f.key), found = d ? d[3](h) : null, inBar = bar.includes(f.key);
      const q = [toggle('Vis popupen', () => !popCfg(f.key).hidden, (v) => popSet(f.key, { hidden: !v }))];
      if (navKnows(f.key)) {
        q.push(toggle('I navbaren', () => navBar().includes(f.key), (v) => {
          const b = navBar().filter((k) => k !== f.key), N2 = navCfg(), more = (Array.isArray(N2.more) ? N2.more : []).filter((k) => k !== f.key);
          if (v) { if (b.length >= 5) { M.haptic('warning'); M.toast('Maks fem · resten ligger i «Mer»'); return false; } b.push(f.key); } else more.unshift(f.key);
          const hidden = (N2.hidden || []).filter((k) => k !== f.key);
          return navSet({ bar: b, more, hidden: hidden.length ? hidden : undefined });
        }));
      }
      L.push({ id: 'fn:' + f.key, g: 'fn', icon: f.icon, color: 'var(--gray1000)', title: popCfg(f.key).name || f.name, sub: [hid ? 'Av' : 'På', found && found[0] ? found[1] : null, inBar ? 'i navbaren' : null].filter(Boolean).join(' · '),
        desc: `Popupen #${f.key} og kortet som tegner den.`, open: { label: 'Tilpass ' + f.name.toLowerCase(), ev: { editor: 'card', tag: f.tag, card_id: 'pop-' + f.key } }, q });
    });
    const ent = M.kioskEntity ? M.kioskEntity() : null, es = ent && h.states[ent];
    L.push({ id: 'kiosk', g: 'enh', icon: 'mdi:fullscreen', color: 'var(--orange)', title: 'Kiosk-modus', sub: `${es ? (es.state === 'on' ? 'På' : 'Av') : 'Bryter mangler'}${bid() ? ' · denne enheten ' + (K.kiosk ? 'i kiosk' : 'normal') : ''}`,
      desc: 'Skjuler Home Assistants header og sidemeny (kiosk-mode). Grupper, enheter og YAML ligger i kiosk-arket.', open: { label: 'Kiosk-innstillinger', ev: { editor: 'kiosk' } },
      q: [toggle('Kiosk-bryteren' + (ent ? ` (${ent})` : ''), () => { const s = ent && hassNow().states[ent]; return !!(s && s.state === 'on'); }, (v) => { const H2 = hassNow(); if (!ent || !H2.states[ent]) { M.toast('Fant ikke ' + ent); return false; } M.call(H2, ent.split('.')[0] === 'input_boolean' ? 'input_boolean' : 'homeassistant', v ? 'turn_on' : 'turn_off', { entity_id: ent }); return true; }),
        ...(bid() ? [toggle('Denne enheten i kiosk', () => kioskState().kiosk, (v) => kioskWrite(v, kioskState().sidebar, devName()))] : [])] });
    L.push({ id: 'haptic', g: 'enh', icon: 'mdi:vibrate', color: 'var(--yellow)', title: 'Haptikk', sub: `${hapticOn() ? 'På' : 'Av'} på denne enheten`,
      desc: 'Vibrasjon ved trykk. Gjelder bare denne enheten.', open: { label: 'Tilpass Hjem', ev: { editor: 'home', focus: 'faner' } },
      q: [toggle('Haptikk på denne enheten', () => hapticOn(), (v) => { if (M.setHapticOff) M.setHapticOff(!v); if (v) M.haptic('medium'); })] });
    L.push({ id: 'enhet', g: 'enh', icon: 'mdi:cellphone', color: 'var(--light-blue)', title: 'Denne enheten', sub: `${devName() || M.deviceInfo().label} · ${M.deviceClassName ? M.deviceClassName(M.deviceClass()) : ''}`,
      desc: `Navn og oppsett for denne nettleseren${bid() ? ' (Browser Mod ' + bid() + ')' : ''}.`, open: { label: 'Innstillinger', popup: '#settings' },
      q: [{ type: 'text', label: 'Enhetsnavn', get: () => devName(), set: (v) => M.store.setDeviceName && M.store.setDeviceName(String(v || '').trim()) },
        ...(bid() ? [toggle('Skjul HA-sidebaren', () => kioskState().sidebar, (v) => kioskWrite(kioskState().kiosk, v, devName()))] : [])] });
    const E = entStats(), eo = E.reduce((s, x) => s + x.o, 0), ee = E.reduce((s, x) => s + x.ex, 0), ei = E.reduce((s, x) => s + x.inc, 0);
    L.push({ id: 'ent', g: 'adv', icon: 'mdi:format-list-checks', color: 'var(--gray1000)', title: 'Entiteter', sub: `${eo} byttet · ${ee} fjernet · ${ei} lagt til`,
      desc: 'Overstyringer av autokonfigurasjonen (overrides / exclude / include) per kort.', kind: 'ent', q: [] });
    L.push({ id: 'backup', g: 'adv', icon: 'mdi:backup-restore', color: 'var(--gray1000)', title: 'Sikkerhetskopi', sub: 'Eksporter eller importer oppsettet som JSON', desc: 'Hele ki-store-oppsettet for brukeren din (alle Tilpass-valg).', kind: 'backup', q: [] });
    L.push({ id: 'rerun', g: 'adv', icon: 'mdi:restart', color: 'var(--gray1000)', title: 'Kjør oppsettet på nytt', sub: 'Onboarding med dagens valg', desc: 'Går gjennom personer, rom, funksjoner, navbar, header og denne enheten igjen.', kind: 'rerun', q: [] });
    return L;
  };
  const reviewable = (L) => L.filter((x) => x.g !== 'adv');
  const reviewed = () => sget('reviewed') || {};
  // Nye rom/funksjoner (ikke med da oppsettet ble fullført) som ikke er sjekket. Del 44: vises ikke lenger som prikk på «Tilpass» i «Mer»
  M.tilpassAltDot = function () {
    const h = hassNow();
    if (!h || !M.store || !sget('onboarded')) return false;
    const known = new Set(sget('onboard_known') || []), R = reviewed();
    if (!known.size) return false;
    const ids = [...roomAreas(h).map((a) => 'rom:' + a.id), ...fnList(h).map((f) => 'fn:' + f.key)];
    return ids.some((id) => !known.has(id) && !R[id]);
  };

  let taOpen = null;
  M.openTilpassAlt = function ({ id, review } = {}) {
    if (taOpen && !taOpen.closed) { if (id) { taOpen.u.sel = id; taOpen.render(); } return taOpen; }
    if (!hassNow() || !M.store) return null;
    const T = { u: { q: '', sel: id || null, hi: null, rev: false } };
    taOpen = T;
    const ov = fullSheet({ css: TA_CSS, onClose: () => { if (unsub) unsub(); if (taOpen === T) taOpen = null; } });
    Object.defineProperty(T, 'closed', { get: () => ov.closed });
    const u = T.u;
    const qMatch = (it, q) => {
      if (!q) return { hit: true };
      const s = (x) => String(x || '').toLowerCase().includes(q);
      if (s(it.title)) return { hit: true };
      const qo = (it.q || []).find((o) => s(o.label) || (o.opts || []).some((p) => s(p[1])));
      if (qo) return { hit: true, quick: qo.label };
      return { hit: s(it.sub) || s(GL[it.g]) || s(it.desc) };
    };
    const rowHtml = (it, R, qm) => `<button class="row" data-a="sel" data-v="${esc(it.id)}" data-key="it-${esc(it.id)}"><span class="ti" style="background:color-mix(in srgb, ${col(it.color)} 22%, transparent);color:${col(it.color)}">${ic(it.icon, 22)}</span>
        <span class="tt"><b>${esc(it.title)}</b><i>${esc(qm && qm.quick ? 'Hurtigvalg · ' + qm.quick : it.sub)}</i></span>${R[it.id] ? `<span class="okc">${ic('mdi:check', 16)}</span>` : ''}${ic('mdi:chevron-right', 22, 'color:var(--ki-text-3, #7f7f7f)')}</button>`;
    const listView = (h) => {
      const L = items(h), R = reviewed(), q = u.q.trim().toLowerCase(), RV = reviewable(L), done = RV.filter((x) => R[x.id]).length;
      const lbl = done === 0 ? 'Start' : done >= RV.length ? 'På nytt' : 'Fortsett';
      const groups = GROUPS.map(([g, gl]) => {
        const rows = L.filter((x) => x.g === g).map((x) => [x, qMatch(x, q)]).filter(([, m]) => m.hit);
        if (!rows.length) return '';
        return `<div class="gh" data-key="g-${g}">${esc(gl)}</div><div class="list" data-key="gl-${g}">${rows.map(([x, m]) => rowHtml(x, R, m)).join('')}</div>`;
      }).join('');
      return `<div class="ob" data-key="ta-list">
        <div class="hd"><span class="h ta">Tilpass alt</span><button class="done" data-a="close">Ferdig</button></div>
        <div class="sr" data-key="sr">${ic('mdi:magnify', 20, 'color:var(--ki-text-3, #7f7f7f)')}<input class="q" data-in="q" data-key="q" placeholder="Søk i innstillinger og hurtigvalg" value="${esc(u.q)}" autocomplete="off">${u.q ? `<button data-a="qx" aria-label="Tøm">${ic('mdi:close-circle', 18, 'color:var(--ki-text-3, #7f7f7f)')}</button>` : ''}</div>
        ${q ? '' : `<div class="rv" data-key="rv"><div class="rvt"><b>Gå gjennom alt</b><i>${done} av ${RV.length} sjekket</i><div class="bar"><span style="width:${RV.length ? Math.round((done / RV.length) * 100) : 0}%"></span></div></div><button class="rvb" data-a="review">${lbl}</button></div>`}
        ${groups || '<p class="lead" style="margin-top:20px">Ingen treff.</p>'}
        <div class="spacer"></div>
      </div>`;
    };
    const quickHtml = (it) => (it.q || []).map((o, i) => {
      const hi = u.hi && u.hi === o.label ? ' hi' : '';
      if (o.type === 'toggle') return `<div class="row${hi}" data-key="q-${i}"><span class="tt"><b>${esc(o.label)}</b></span>${sw(o.get(), 'qt', `data-i="${i}"`)}</div>`;
      if (o.type === 'seg') return `<div class="qb${hi}" data-key="q-${i}"><div class="lbl">${esc(o.label)}</div><div class="seg">${o.opts.map(([k, l]) => `<button class="${o.get() === k ? 'on' : ''}" data-a="qs" data-i="${i}" data-v="${esc(k)}">${esc(l)}</button>`).join('')}</div></div>`;
      if (o.type === 'colors') { const cur = o.get(); return `<div class="qb${hi}" data-key="q-${i}"><div class="lbl">${esc(o.label)}</div><div class="cols">${COLS.map((c) => `<button class="cl ${String(cur) === c ? 'on' : ''}" data-a="qc" data-i="${i}" data-v="${esc(c)}" style="background:${col(c)}" aria-label="${esc(c)}"></button>`).join('')}</div></div>`; }
      if (o.type === 'text') return `<div class="qb${hi}" data-key="q-${i}"><div class="lbl">${esc(o.label)}</div><input class="in" data-in="qtext" data-i="${i}" data-key="qt-${i}" value="${esc(o.get() || '')}" placeholder="${esc(bmName || M.deviceInfo().label)}"></div>`;
      return '';
    }).join('');
    const extraHtml = (it) => {
      if (it.kind === 'ent') {
        const E = entStats();
        return `<div class="list">${E.length ? E.map((x) => `<button class="row" data-a="entopen" data-v="${esc(x.grp + '.' + x.id)}"><span class="tt"><b>${esc(x.grp === 'rooms' ? 'Rom · ' + M.areaName(hassNow(), x.id) : x.id)}</b><i>${x.o} byttet · ${x.ex} fjernet · ${x.inc} lagt til</i></span>${ic('mdi:chevron-right', 22, 'color:var(--ki-text-3, #7f7f7f)')}</button>`).join('') : '<p class="note">Ingen overstyringer – alt kommer fra autokonfigurasjonen.</p>'}</div>`;
      }
      if (it.kind === 'backup') return `<div class="list"><button class="row" data-a="export"><span class="ti" style="background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)))">${ic('mdi:download', 22)}</span><span class="tt"><b>Eksporter</b><i>Last ned som JSON (kopieres også)</i></span></button>
        <label class="row" style="cursor:pointer"><span class="ti" style="background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)))">${ic('mdi:upload', 22)}</span><span class="tt"><b>Importer</b><i>Erstatter oppsettet med filen</i></span><input type="file" accept="application/json,.json" data-in="import" style="display:none"></label></div>`;
      if (it.kind === 'rerun') return `<button class="main" data-a="rerun">Kjør oppsettet</button>`;
      return '';
    };
    const detailView = (h) => {
      const L = items(h), it = L.find((x) => x.id === u.sel);
      if (!it) { u.sel = null; return listView(h); }
      const RV = reviewable(L), idx = RV.findIndex((x) => x.id === it.id);
      const top = u.rev
        ? `<div class="hd"><button class="b44" data-a="rvx" aria-label="Avbryt">${ic('mdi:close', 24)}</button><span class="h sm">Steg ${idx + 1} av ${RV.length} · ${esc(GL[it.g])}</span></div><div class="bar big"><span style="width:${Math.round(((idx + 1) / RV.length) * 100)}%"></span></div>`
        : `<div class="hd"><button class="b44" data-a="back" aria-label="Tilbake">${ic('mdi:chevron-left', 26)}</button><span class="h sm">${esc(GL[it.g])}</span></div>`;
      const open = it.open ? `<button class="opn" data-a="openfull">Åpne «${esc(it.open.label)}» ↗</button>` : '';
      return `<div class="ob" data-key="ta-d-${esc(it.id)}">
        ${top}
        <div class="dic" style="background:color-mix(in srgb, ${col(it.color)} 22%, transparent);color:${col(it.color)}">${ic(it.icon, 40)}</div>
        <h2 style="margin-top:14px">${esc(it.title)}</h2><p class="lead">${esc(it.desc || it.sub)}</p>
        ${it.q && it.q.length ? `<div class="gh">Hurtigvalg</div><div class="list">${quickHtml(it)}</div>` : ''}
        ${extraHtml(it)}
        ${open}
        <div class="spacer"></div>
        ${u.rev ? `<div class="foot"><button class="main" data-a="rvok">Ser bra ut · neste</button><button class="ghost" data-a="rvskip">Hopp over</button></div>` : ''}
      </div>`;
    };
    const render = () => { const h = hassNow(); return h ? (u.sel ? detailView(h) : listView(h)) : '<div class="ob"><p class="lead">Venter på Home Assistant …</p></div>'; };
    let raf = 0;
    const upd = () => { if (ov.closed) return; M.morph(ov.body, render()); };
    const sched = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; upd(); }); };
    T.render = upd;
    const unsub = M.store.subscribe(() => sched());
    const top0 = () => { const sh = ov.root.querySelector('.sh'); if (sh) sh.scrollTop = 0; };
    const cur = () => items(hassNow()).find((x) => x.id === u.sel);
    const RVL = () => reviewable(items(hassNow()));
    const revGo = (id) => { u.sel = id; u.hi = null; put('review_at', id); top0(); upd(); };
    const revNext = (mark) => {
      const L = RVL(), i = L.findIndex((x) => x.id === u.sel);
      if (mark && u.sel) put('reviewed', { ...reviewed(), [u.sel]: true });
      const nx = L[i + 1];
      if (!nx) { u.rev = false; u.sel = null; put('review_at', undefined); M.haptic('success'); M.toast('Gjennomgang ferdig'); top0(); return upd(); }
      M.haptic('light');
      revGo(nx.id);
    };
    ov.root.addEventListener('input', (e) => {
      const t = e.target, d = (t && t.dataset) || {};
      if (d.in === 'q') { u.q = t.value; upd(); }
    });
    ov.root.addEventListener('change', (e) => {
      const t = e.target, d = (t && t.dataset) || {};
      if (d.in === 'qtext') { const it = cur(), o = it && it.q[+d.i]; if (o) { M.haptic('selection'); o.set(t.value); } }
      if (d.in === 'import' && t.files && t.files[0]) {
        const f = t.files[0];
        f.text().then((txt) => {
          let v;
          try { v = JSON.parse(txt); } catch (err) { M.haptic('failure'); M.toast('Ugyldig JSON'); return; }
          if (!v || typeof v !== 'object' || Array.isArray(v)) { M.haptic('failure'); M.toast('Ugyldig oppsett'); return; }
          if (!window.confirm('Erstatte hele oppsettet med filen?')) return;
          const devs = sget('devices');
          M.store.set('', { ...v, ...(devs ? { devices: { ...(v.devices || {}), ...devs } } : {}) }, { immediate: true }).then((r) => { M.haptic(r && r.ok === false ? 'failure' : 'success'); M.toast(r && r.ok === false ? 'Kunne ikke lagre' : 'Oppsett importert'); });
        });
        t.value = '';
      }
    });
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]');
      if (!el || el.disabled) return;
      const a = el.dataset.a, v = el.dataset.v, it = u.sel ? cur() : null;
      switch (a) {
        case 'close': M.haptic('light'); return ov.close();
        case 'qx': M.haptic('light'); u.q = ''; return upd();
        case 'sel': {
          M.haptic('light');
          const L = items(hassNow()), x = L.find((y) => y.id === v), q = u.q.trim().toLowerCase();
          u.hi = x && q ? (qMatch(x, q).quick || null) : null;
          u.sel = v; top0(); return upd();
        }
        case 'back': M.haptic('light'); u.sel = null; u.hi = null; top0(); return upd();
        case 'review': {
          const L = RVL(), R = reviewed(), done = L.filter((x) => R[x.id]).length;
          u.rev = true;
          if (done >= L.length) { put('reviewed', {}); M.haptic('light'); return revGo(L[0].id); }
          const at = sget('review_at'), a2 = L.find((x) => x.id === at && !R[x.id]) || L.find((x) => !R[x.id]) || L[0];
          M.haptic('light');
          return revGo(a2.id);
        }
        case 'rvx': M.haptic('light'); u.rev = false; u.sel = null; top0(); return upd(); // progresjonen (reviewed/review_at) beholdes
        case 'rvok': return revNext(true);
        case 'rvskip': return revNext(false);
        case 'qt': {
          const o = it && it.q[+el.dataset.i];
          if (!o) return;
          M.haptic('selection');
          const r = o.set(!o.get());
          if (r === false) return;
          return sched();
        }
        case 'qs': case 'qc': { const o = it && it.q[+el.dataset.i]; if (!o) return; M.haptic('selection'); o.set(v); return sched(); }
        case 'openfull': {
          if (!it || !it.open) return;
          if (it.open.popup) { M.haptic('light'); ov.close(); return M.openPopup && M.openPopup(it.open.popup); }
          return emit(it.open.ev); // «Tilpass X» åpnes oppå (legges sist i ki-overlay-root)
        }
        case 'entopen': {
          const [grp, id] = [v.split('.')[0], v.slice(v.indexOf('.') + 1)];
          if (grp === 'rooms') return emit({ editor: 'room', area: id });
          if (/^room-/.test(id)) return emit({ editor: 'room', area: id.slice(5) });
          const I = M.CARD_IDS || {};
          if (id === I.navbar) return emit({ editor: 'navbar' });
          if (id === I.header) return emit({ editor: 'header' });
          if (/^pop-/.test(id)) { const f = (M.FUNCTION_POPUPS || []).find((x) => (M.popupCardId ? M.popupCardId(x[0]) : 'pop-' + x[0].slice(1)) === id); if (f) return emit({ editor: 'card', tag: f[3], card_id: id }); }
          return emit({ editor: 'home' });
        }
        case 'export': {
          M.haptic('light');
          const txt = JSON.stringify(M.store.get() || {}, null, 2);
          try {
            const url = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
            const aEl = document.createElement('a'); aEl.href = url; aEl.download = 'ki-dashboard-' + new Date().toISOString().slice(0, 10) + '.json';
            document.body.appendChild(aEl); aEl.click(); aEl.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
          } catch (err) { /* */ }
          if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => M.toast('Eksportert · også kopiert'), () => M.toast('Eksportert'));
          else M.toast('Eksportert');
          return;
        }
        case 'rerun': M.haptic('light'); ov.close(); return M.openOnboarding({ step: 1 });
        default:
      }
    });
    upd();
    if (review) { const L = RVL(); if (L.length) { u.rev = true; revGo((L.find((x) => !reviewed()[x.id]) || L[0]).id); } }
    return T;
  };
  const TA_CSS = `
    .hd{display:flex;align-items:center;gap:12px;min-height:44px}
    .hd .h{flex:1;min-width:0;font-size:28px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .hd .h.sm{font-size:14px;color:var(--ki-text-mid, #979797);font-weight:500}
    .done{${M.DONE_PILL}flex:none} /* Fiks 26: Ferdig = rosa pille øverst til høyre */
    .hd .h.ta{font-size:22px;font-weight:600;letter-spacing:-0.01em}
    .sr{display:flex;align-items:center;gap:8px;height:48px;padding:0 14px;margin:16px 0 12px;border-radius:24px;background:var(--ki-sheet-in,#404040)}
    .sr .q{flex:1;min-width:0;height:100%;border:0;background:none;color:var(--ki-text, #fafafa);font-size:16px;outline:none}
    .rv{display:flex;align-items:center;gap:14px;padding:16px;border-radius:24px;background:var(--ki-sheet-grp,#3a3a3a)}
    .rvt{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
    .rvt b{font-size:16px;font-weight:500}.rvt i{font-style:normal;font-size:13px;color:var(--ki-text-mid, #979797)}
    .bar{height:4px;border-radius:2px;background:var(--ki-surface-2, var(--gray300,#404040));overflow:hidden;margin-top:4px}
    .bar span{display:block;height:100%;border-radius:2px;background:${PINK};transition:width .3s}
    .bar.big{margin:10px 0 0}
    .rvb{height:40px;padding:0 18px;border-radius:20px;background:${PINK};color:var(--ki-on-accent, #2a1720);font-size:15px;font-weight:600;flex:none}
    .gh{font-size:13px;color:var(--ki-text-mid, #979797);margin:22px 4px 8px}
    .okc{width:24px;height:24px;border-radius:12px;display:grid;place-items:center;background:${GREEN};color:var(--ki-on-accent, #232323);flex:none}
    .dic{width:80px;height:80px;border-radius:28px;display:grid;place-items:center;margin-top:20px}
    .qb{padding:12px 14px 14px;border-radius:24px;background:var(--ki-sheet-grp,#3a3a3a)}
    .qb .lbl{margin:0 2px 8px}
    .hi{box-shadow:inset 0 0 0 2px #f285c9}
    .cols{display:flex;flex-wrap:wrap;gap:10px}
    .cl{width:36px;height:36px;border-radius:18px}
    .cl.on{box-shadow:0 0 0 2px var(--ki-popup, #282828),0 0 0 4px var(--ki-text, #fafafa)}
    .opn{height:52px;border-radius:26px;background:var(--ki-sheet-grp,#3a3a3a);font-size:15px;font-weight:500;width:100%;margin-top:18px}
  `;

  /* ------------------------------------------------------------ hendelsesbussen: flere mål for ki-open-editor */
  // 03-editors.js kaller M.openDashEditor(detail) ved hver hendelse – utvidet her (uten å endre bussen):
  //   { editor: 'card', tag, card_id, focus } → kortets eget «Tilpass»-ark (levende kort, ellers frakoblet instans)
  //   { editor: 'kiosk' } → kiosk-arket · { editor: 'tilpass-alt', id, review } · { editor: 'onboarding', step }
  if (M.openDashEditor && !M.__obBus) {
    M.__obBus = true;
    const base = M.openDashEditor;
    M.openDashEditor = function (d) {
      d = d || {};
      if (d.editor === 'tilpass-alt') return M.openTilpassAlt(d);
      if (d.editor === 'onboarding') return M.openOnboarding(d);
      if (d.editor === 'kiosk') return M.kioskSheet ? M.kioskSheet() : null;
      if (d.editor === 'card' && d.tag) {
        let el = M.liveOf && M.liveOf(d.tag, (c) => !d.card_id || (c.config && c.config.card_id) === d.card_id);
        if (!el && M.liveOf) el = M.liveOf(d.tag);
        if (!el && customElements.get(d.tag)) {
          el = document.createElement(d.tag);
          try { el.setConfig({ type: 'custom:' + d.tag, card_id: d.card_id || M.uid() }); } catch (e) { return null; }
          el.hass = hassNow();
        }
        return el && el.customize ? el.customize(d.focus) : null;
      }
      return base.call(this, d);
    };
  }
})();
