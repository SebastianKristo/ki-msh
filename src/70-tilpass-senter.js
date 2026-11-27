/* Fiks 25.3 / 26 · Tilpass-senteret, veiviseren og «Rediger Hjem» (fasit: design/Tilpass.dc.html, fanene Veiviser · Hjem · Tilpass)
 *
 * Alt som kan tilpasses ligger ett sted: <ki-customize-center> i et helskjerm-ark i ki-overlay-root. Hver endring går
 * gjennom MSH.tps.commit(mutasjon, melding, nøkkel): forrige oppsett legges på en angre-stakk (maks 40), toast med «Angre»
 * vises (ikke i veiviseren), og «Lagrer…» → «Lagret» i headeren. Like endringer med samme nøkkel innen 1,5 s er én angring
 * (glidebrytere, tekstfelt). Endringene skrives RETT i kortenes egen config i ki-store (samme nøkler som «Tilpass alt»,
 * 54b) eller i ki-store tilpass.* – det finnes ingen egen kopi av oppsettet.
 *
 *   MSH.tps.open(side?)        Tilpass-senteret (side: tema | sprak | header | kort | navbar | rom | personer | popups | var | kiosk)
 *   MSH.tps.wizard()           veiviseren <ki-setup-wizard> (starter selv når brukeren ikke har lagret oppsett)
 *   MSH.tps.editHome()         «Rediger Hjem» (også langt trykk på et kort på Hjem, 25-hjem.js)
 *   MSH.tps.commit/undo        angre-motoren · MSH.tps.vars() grensene · MSH.tps.applyTheme()
 *
 * Tema (tilpass.theme/bg/density/corner) blir CSS-variabler på <html>: --ki-accent/--ki-grad (+ --pink for kortene),
 * --ki-bg/--ki-surface/--ki-surface-2/--ki-popup (bare mørk modus, bare når bakgrunnen ikke er Grafitt), --ki-gap, --ki-radius.
 * Installatørmodus lagres per HA-bruker (localStorage), «Lås for kunden» for hele dashbordet (tilpass.lock).
 */
(function () {
  const M = window.MSH;
  if (!M || M.tps) return;
  const esc = M.esc;
  const T = (n, e) => (window.kiT ? window.kiT(n, e) : n);
  const ic = (n, s, st) => M.icon(n, s || 22, st || '');
  const hassNow = () => M.lastHass || ((document.querySelector('home-assistant') || {}).hass) || null;
  const sget = (p) => (M.store ? M.store.get(p) : undefined);
  const sset = (p, v) => (M.store ? M.store.set(p, v) : null);
  const clean = (o) => { const r = { ...(o || {}) }; Object.keys(r).forEach((k) => { if (r[k] === undefined) delete r[k]; }); return r; };
  const getP = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setP = (o, p, v) => { const ks = String(p).split('.'), out = { ...(o || {}) }; let cur = out; ks.forEach((k, i) => { if (i === ks.length - 1) { if (v === undefined) delete cur[k]; else cur[k] = v; } else { cur[k] = cur[k] && typeof cur[k] === 'object' && !Array.isArray(cur[k]) ? { ...cur[k] } : {}; cur = cur[k]; } }); return out; };
  const nf = (v, d) => (v == null || isNaN(v) ? '–' : Number(v).toFixed(d == null ? 0 : d).replace('.', ','));

  /* ------------------------------------------------------------ designets verdier */
  const ACC = { rosa: ['Rosa', 'rgb(242 133 201)', 'rgb(245 205 198)'], hav: ['Hav', 'rgb(115 185 242)', 'rgb(188 226 246)'], skog: ['Skog', 'rgb(102 209 158)', 'rgb(206 238 198)'], rav: ['Rav', 'rgb(242 181 115)', 'rgb(247 222 182)'], lilla: ['Lilla', 'rgb(180 156 240)', 'rgb(224 210 248)'] };
  const BGS = { grafitt: ['Grafitt', '#232323', '#2e2e2e', '#3a3a3a'], svart: ['Svart', '#000000', '#141414', '#262626'], varm: ['Varm', '#24201d', '#2f2a26', '#3c3631'] }; // ki-hex-ok: designets bakgrunner (velgerpalett)
  const META = {
    tema: ['mdi:palette-outline', 'Tema og farger', 'tema farge farger bakgrunn mørk utseende tetthet hjørner'],
    sprak: ['mdi:translate', 'Språk og navn', 'språk tekst tekster navn engelsk nynorsk entitet entiteter'],
    header: ['mdi:hand-wave-outline', 'Header og hilsen', 'header hilsen topp velkommen'],
    kort: ['mdi:view-dashboard-outline', 'Faner og kort', 'kort hjem faner fane etasje rekkefølge skjul flytte swipe snarvei tekst'],
    navbar: ['mdi:dock-bottom', 'Navbar', 'navbar meny knapper bunn svevende'],
    rom: ['mdi:door', 'Rom', 'rom område etasje temperatur sensor'],
    personer: ['mdi:account-group-outline', 'Personer', 'personer familie hjemme borte telefon'],
    popups: ['mdi:application-outline', 'Popups', 'popup popups vindu'],
    var: ['mdi:tune-variant', 'Grenser og verdier', 'variabler grenser verdier strøm strømpris temperatur komfort natt batteri pris'],
    kiosk: ['mdi:tablet', 'Kiosk og skjermer', 'kiosk skjerm nettbrett ipad veggskjerm enhet enheter'],
  };
  const GROUPS = [['Utseende', ['tema', 'sprak']], ['Hjem', ['header', 'kort', 'navbar']], ['Huset', ['rom', 'personer', 'popups']], ['Verdier og skjermer', ['var', 'kiosk']]];
  const CHIPS = [['vaer', 'mdi:weather-partly-cloudy', 'Vær', '{temp} {vaer}'], ['strom', 'mdi:flash', 'Strømpris', '{strom}'], ['hjemme', 'mdi:account-group', 'Hvem er hjemme', '{hjemme}'], ['kalender', 'mdi:calendar', 'Neste i kalenderen', '{kalender}'], ['soppel', 'mdi:delete-outline', 'Søppel', '{soppel}']];
  const VARS = [
    ['Strøm', [['billig', 'Billig strøm under', 0.2, 1.5, 0.05, 'kr', 'Strømkort og oppsummering', 'input_number.ki_strom_billig', 0.6], ['dyr', 'Dyr strøm over', 0.8, 3, 0.05, 'kr', 'Strømkort, varsler og navbar-prikken', 'input_number.ki_strom_dyr', 1.5]]],
    ['Temperatur', [['komfort', 'Komfort', 16, 25, 0.5, '°', 'Klima og romkortene', 'input_number.ki_temp_komfort', 21], ['natt', 'Natt', 14, 22, 0.5, '°', 'Klima om natten', 'input_number.ki_temp_natt', 18], ['borte', 'Borte', 10, 20, 0.5, '°', 'Klima når alle er borte', 'input_number.ki_temp_borte', 16]]],
    ['Varsler', [['batteri', 'Lavt batteri under', 5, 50, 5, '%', 'Batterivarsel og Innstillinger', 'input_number.ki_batteri_lav', 20], ['borteMin', 'Regn som borte etter', 2, 60, 1, 'min', 'Hvem er hjemme og Klima', 'input_number.ki_borte_min', 10]]]];
  const VDEF = Object.fromEntries(VARS.flatMap(([, it]) => it.map((x) => [x[0], x[8]])));
  const KMODE = [['vanlig', 'Vanlig'], ['kiosk', 'Kiosk'], ['vegg', 'Veggskjerm']];
  const KEXP = { vanlig: 'Viser Home Assistant-menyen og sidebaren som vanlig.', kiosk: 'Skjuler menyen og sidebaren. Bare dashbordet vises.', vegg: 'Som kiosk. Skjermen dimmes om natten og viser klokke når ingen er i nærheten.' };
  const WHEN = { alltid: 'Vises alltid', hjemme: 'Når noen er hjemme', kveld: 'Bare om kvelden' };
  const HOMEB = { header: ['mdi:hand-wave-outline', 'Header'], prosa: ['mdi:text', 'Tekst øverst'], faner: ['mdi:view-grid-outline', 'Faner og romkort'], soppel: ['mdi:delete-outline', 'Søppel'], strom: ['mdi:flash', 'Strømpris'], gjoremal: ['mdi:checkbox-marked-outline', 'Gjøremål'] };
  const HOMEK = Object.keys(HOMEB);
  const fV = (v, u) => (u === 'kr' ? nf(v, 2) + ' kr' : u === '°' ? String(v).replace('.', ',') + '°' : v + ' ' + u);

  /* ------------------------------------------------------------ kortenes config (samme nøkler som «Tilpass alt», 54b) */
  const CID = () => M.CARD_IDS || {};
  const cardId = (tag, def) => { const l = M.liveOf && M.liveOf(tag); return (l && l.config && l.config.card_id) || def; };
  const cardCfg = (tag, def) => { const l = M.liveOf && M.liveOf(tag); return { ...((l && l.config) || {}), ...((M.store && M.store.card(cardId(tag, def))) || {}) }; };
  const cardSet = (tag, def, patch) => { const id = cardId(tag, def); return sset('cards.' + id, clean({ ...((M.store && M.store.card(id)) || {}), ...patch })); };
  const HDR = ['msh-hjem-header-card', 'ki-home-header'], NAV = ['msh-navbar-card', 'ki-navbar'], FAN = ['msh-hjem-faner-card', 'ki-home-faner'], HOME = ['msh-hjem-card', 'ki-home'];
  const hdr = () => cardCfg(HDR[0], CID().header || HDR[1]), hdrSet = (p) => cardSet(HDR[0], CID().header || HDR[1], p);
  const nav = () => cardCfg(NAV[0], CID().navbar || NAV[1]), navSet = (p) => cardSet(NAV[0], CID().navbar || NAV[1], p);
  const fan = () => cardCfg(FAN[0], CID().faner || FAN[1]), fanSet = (p) => cardSet(FAN[0], CID().faner || FAN[1], p);
  const home = () => cardCfg(HOME[0], CID().home || HOME[1]), homeSet = (p) => cardSet(HOME[0], CID().home || HOME[1], p);
  const prof = () => (M.hjemHeaderProfile ? M.hjemHeaderProfile() : {});
  const profSet = (p) => (M.profileSet ? M.profileSet('header_profiles', p) : null);
  const tp = () => sget('tilpass') || {};
  const tpSet = (k, v) => sset('tilpass.' + k, v);
  const proKey = () => 'ki-tps-pro:' + (((hassNow() || {}).user || {}).id || 'x');
  const isAdmin = () => (((hassNow() || {}).user || {}).is_admin) !== false;
  const proOn = () => { try { return isAdmin() && localStorage.getItem(proKey()) === '1'; } catch (e) { return false; } };
  const proSet = (on) => { try { if (on) localStorage.setItem(proKey(), '1'); else localStorage.removeItem(proKey()); } catch (e) { /* */ } };
  const locked = (k) => !!tp().lock && !proOn() && !['tema', 'kort'].includes(k);

  /* ------------------------------------------------------------ angre-motor */
  const TPS = (M.tps = { hist: [], saving: false });
  let lastKey = null, lastT = 0, saveT = 0, inWizard = false;
  const snap = () => JSON.parse(JSON.stringify((M.store && M.store.get()) || {}));
  const live = new Set(); // åpne Tilpass-flater som tegnes på nytt etter endringer
  const rerender = () => live.forEach((f) => { try { f(); } catch (e) { console.error('[ki-tps]', e); } });
  TPS.commit = function (mut, msg, key) {
    const now = Date.now(), same = key && lastKey === key && now - lastT < 1500;
    lastKey = key || null; lastT = now;
    if (!same) { TPS.hist.push(snap()); if (TPS.hist.length > 40) TPS.hist.shift(); }
    try { mut(); } catch (e) { console.error('[ki-tps] endring', e); }
    TPS.saving = true; clearTimeout(saveT); saveT = setTimeout(() => { TPS.saving = false; rerender(); }, 600);
    if (msg && !inWizard) toast(msg, true);
    M.haptic('selection');
    rerender();
  };
  TPS.undo = function () {
    const prev = TPS.hist.pop();
    if (!prev) return;
    lastKey = null;
    if (M.store) M.store.set('', prev);
    toast(T('Endringen er angret', 'The change was undone'), false);
    M.haptic('light');
    rerender();
  };
  TPS.vars = () => ({ ...VDEF, ...((tp().vars) || {}) });
  TPS.varSet = function (k) { return Object.prototype.hasOwnProperty.call(tp().vars || {}, k); };

  /* ------------------------------------------------------------ toast (ki-overlay-root, over navbaren) */
  let toastEl = null, toastT = 0;
  function toast(msg, undo) {
    const slot = M.overlayRoot && M.overlayRoot();
    if (!slot) return;
    if (!toastEl || !toastEl.isConnected) {
      toastEl = document.createElement('div');
      toastEl.className = 'ki-tps-toast';
      toastEl.setAttribute('role', 'status');
      toastEl.attachShadow({ mode: 'open' });
      slot.appendChild(toastEl);
    }
    const nb = document.querySelector('.msh-navbar-portal'), navOn = !!(nb && nb.shadowRoot && nb.shadowRoot.querySelector('nav.nb')) && !document.querySelector('.msh-portal[data-tilpass]');
    const R = (M.dashRect && M.dashRect()) || { left: 0, width: innerWidth };
    const can = undo && TPS.hist.length;
    Object.assign(toastEl.style, { position: 'fixed', zIndex: '9700', left: Math.round(R.left + 16) + 'px', width: Math.round(Math.min(R.width - 32, 408)) + 'px', bottom: `calc(${navOn ? 100 : 24}px + env(safe-area-inset-bottom, 0px))`, pointerEvents: 'auto' });
    toastEl.shadowRoot.innerHTML = `<style>:host{font-family:${M.FONT}}
      .t{display:flex;align-items:center;gap:10px;min-height:52px;padding:0 8px 0 16px;border-radius:26px;background:var(--ki-tps-toast, #474747);color:var(--ki-text, #fafafa);box-shadow:0 10px 30px rgb(0 0 0/.45);animation:tin .25s ease;box-sizing:border-box}
      .m{flex:1;min-width:0;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .i{flex:none;color:var(--ki-accent, rgb(242 133 201));display:flex}.i ha-icon{--mdc-icon-size:20px;width:20px;height:20px}
      button{font:inherit;border:0;cursor:pointer;height:36px;padding:0 14px;border-radius:18px;background:rgb(255 255 255/.1);font-size:14px;font-weight:600;color:var(--ki-accent, rgb(242 133 201));flex:none}
      @keyframes tin{from{transform:translateY(12px);opacity:0}}@media (prefers-reduced-motion: reduce){.t{animation:none}}</style>
      <div class="t"><span class="i">${ic(can ? 'mdi:check-circle' : 'mdi:information-outline', 20)}</span><span class="m">${esc(msg)}</span>${can ? `<button data-a="undo">${esc(T('Angre', 'Undo'))}</button>` : ''}</div>`;
    const b = toastEl.shadowRoot.querySelector('button');
    if (b) b.addEventListener('click', (e) => { e.stopPropagation(); TPS.undo(); });
    ['pointerdown', 'click', 'touchstart'].forEach((t) => toastEl.addEventListener(t, (e) => e.stopPropagation(), { passive: true }));
    clearTimeout(toastT); toastT = setTimeout(() => { if (toastEl) toastEl.remove(); toastEl = null; }, can ? 4000 : 2400);
  }
  TPS.toast = toast;

  /* ------------------------------------------------------------ tema → CSS-variabler */
  TPS.applyTheme = function () {
    const c = tp(), st = document.documentElement.style, A = ACC[c.theme] || ACC.rosa, B = BGS[c.bg] || BGS.grafitt;
    const dark = !(M.theme && M.theme.mode && M.theme.mode() === 'light');
    const setv = (k, v) => { if (v == null) { if (st.getPropertyValue(k)) st.removeProperty(k); } else if (st.getPropertyValue(k) !== v) st.setProperty(k, v); };
    const accent = c.theme && c.theme !== 'rosa';
    setv('--ki-accent', accent ? A[1] : null);
    setv('--ki-grad', accent ? `linear-gradient(145deg, ${A[1]} -10%, ${A[2]} 100%)` : null);
    setv('--pink', accent ? A[1] : null); // kortene bruker var(--pink, …) som aksent
    const bg = dark && c.bg && c.bg !== 'grafitt';
    setv('--ki-bg', bg ? B[1] : null); setv('--ki-popup', bg ? B[1] : null); setv('--ki-surface', bg ? B[2] : null); setv('--ki-surface-2', bg ? B[3] : null);
    setv('--ki-gap', c.density === 'kompakt' ? '8px' : null);
    setv('--ki-radius', c.corner === 'myk' ? '14px' : null);
  };
  if (M.store && M.store.subscribe) M.store.subscribe((d, path) => { if (!path || /^tilpass(\.|$)/.test(path)) TPS.applyTheme(); if (live.size && !TPS.saving) rerender(); });
  window.addEventListener('ki-theme-change', () => TPS.applyTheme());
  setTimeout(() => TPS.applyTheme(), 0);

  /* ------------------------------------------------------------ data fra huset */
  const areaOf = (h, id) => (M.areaOf ? M.areaOf(h, id) : null);
  function roomsModel(h) {
    if (!h) return [];
    const A = M.areas(h), c = fan(), TT = M.hjemAllTabs ? M.hjemAllTabs(h, c) : [];
    const hjemCards = M.hjemCards ? (M.hjemCards(h, c).cards || []) : [];
    const tabOf = (a) => (TT.find((t) => t.kind === 'floor' && t.floor === a.floor) || TT.find((t) => t.kind === 'andre') || null);
    return A.map((a) => {
      const t = tabOf(a), hid = new Set((t && getP(c, `layout.${t.id}.hidden`)) || []);
      const pop = sget('popups.' + a.id) || {};
      const rc = (M.roomClimate && M.roomClimate(h, a.id, {})) || {};
      const lights = M.all(h, 'light', (s, id) => areaOf(h, id) === a.id);
      return { id: a.id, name: a.name, icon: a.icon || 'mdi:door', floor: a.floor || '', floorName: a.floorName || '', tab: t, on: !hid.has(a.id) && !pop.hidden, fav: hjemCards.includes('rom:' + a.id), temp: rc.temp && rc.temp.v, hum: rc.hum && rc.hum.v, lights: lights.length, tempId: rc.temp && rc.temp.id, humId: rc.hum && rc.hum.id };
    });
  }
  function roomOrder(h, R) {
    const c = fan(), by = {};
    R.forEach((r) => { const k = r.tab ? r.tab.id : '_'; (by[k] = by[k] || []).push(r); });
    Object.keys(by).forEach((k) => { if (k === '_') return; const t = by[k][0].tab, base = M.hjemBaseRooms ? M.hjemBaseRooms(h, c, t).map((x) => x.id) : []; by[k].sort((a, b) => (base.indexOf(a.id) + 1 || 999) - (base.indexOf(b.id) + 1 || 999)); });
    return by;
  }
  function setRoomOn(h, r, on) {
    const c = fan();
    if (r.tab) { const hid = new Set(getP(c, `layout.${r.tab.id}.hidden`) || []); if (on) hid.delete(r.id); else hid.add(r.id); fanSet({ layout: setP(c.layout || {}, `${r.tab.id}.hidden`, [...hid]) }); }
    const pop = { ...(sget('popups.' + r.id) || {}) };
    if (on) delete pop.hidden; else pop.hidden = true;
    sset('popups.' + r.id, Object.keys(pop).length ? pop : undefined);
  }
  function setRoomFav(h, r, fav) {
    const c = fan(), H = M.hjemCards(h, c), list = (H.cards || []).filter((x) => x !== 'rom:' + r.id);
    if (fav) list.push('rom:' + r.id);
    fanSet({ tabs: { ...(c.tabs || {}), hjem: { ...((c.tabs || {}).hjem || {}), auto_fill: false, cards: list, seen: H.candidates || ((c.tabs || {}).hjem || {}).seen } } });
  }
  function personsModel(h) {
    if (!h) return [];
    const P = prof(), c = hdr(), ppl = M.all(h, 'person');
    const ord = Array.isArray(P.people_order) ? P.people_order : ppl, O = [...ord.filter((x) => ppl.includes(x)), ...ppl.filter((x) => !ord.includes(x))];
    const hid = new Set(Array.isArray(P.people_hidden) ? P.people_hidden : (Array.isArray(c.people) ? c.people.filter((r) => r && r.hidden).map((r) => r.person) : []));
    const COL = ['rgb(242 133 201)', 'rgb(115 185 242)', 'rgb(242 181 115)', 'rgb(102 209 158)', 'rgb(180 156 240)'];
    return O.map((id, i) => {
      const s = h.states[id] || { attributes: {} }, tr = (s.attributes.device_trackers || [])[0];
      return { id, name: M.name(h, id), dev: tr ? M.name(h, tr) : T('ingen enhet', 'no device'), home: s.state === 'home', on: !hid.has(id), c: COL[i % COL.length], pic: s.attributes.entity_picture || '' };
    });
  }
  function navModel() {
    const c = nav(), CAT = M.navCat ? M.navCat() : {}, N = M.navNorm ? M.navNorm(c) : { B: c.buttons || {}, bar: c.bar || [], more: c.more || [], hidden: new Set(c.hidden || []) };
    const cat = (id) => { const b = (N.B || {})[id] || {}, d = CAT[id] || ['mdi:star', id]; return [b.icon || d[0], b.label || d[1]]; };
    const order = [...N.bar, ...N.more].filter((id, i, a) => a.indexOf(id) === i);
    const list = order.map((id) => ({ id, icon: cat(id)[0], label: cat(id)[1], on: !N.hidden.has(id) }));
    return { c, list };
  }
  function navWrite(list) {
    const on = list.filter((x) => x.on).map((x) => x.id), off = list.filter((x) => !x.on).map((x) => x.id);
    navSet({ bar: on.slice(0, 5), more: [...on.slice(5), ...off], hidden: off });
  }
  function popupModel(h) {
    if (!h || !M.allPopups) return [];
    const L = M.allPopups(h, { hidden: true }).filter((p) => p.group !== 'rom' && !/^#person-/.test(p.hash || ''));
    return L.map((p) => ({ hash: p.hash, key: String(p.hash || '').replace(/^#/, ''), name: p.name, icon: p.icon || 'mdi:application-outline', on: !p.hidden, reason: reasonOf(h, p.hash) }));
  }
  const DOMS = { '#kamera': ['camera', 'kamera', 'kameraer'], '#media': ['media_player', 'høyttaler eller TV', 'høyttalere og TV-er'], '#lys': ['light', 'lys', 'lys'], '#klima': ['climate', 'termostat', 'termostater'], '#sikkerhet': ['alarm_control_panel', 'alarm', 'alarmer'], '#dorlas': ['lock', 'dørlås', 'dørlåser'], '#vaer': ['weather', 'værmelding', 'værmeldinger'], '#gjoremal': ['todo', 'gjøremålsliste', 'gjøremålslister'], '#vanning': ['valve', 'ventil', 'ventiler'], '#kalender': ['calendar', 'kalender', 'kalendere'] };
  function reasonOf(h, hash) {
    const d = DOMS[hash];
    if (d) { const n = M.all(h, d[0]).length; return n ? `${T('Vi fant', 'We found')} ${n} ${n === 1 ? d[1] : d[2]}` : T('Lages fordi noe peker hit', 'Made because something links here'); }
    return T('Laget ut fra det vi fant i huset', 'Made from what we found in the house');
  }
  function kioskModel() {
    const D = sget('devices') || {}, K = sget('kiosk') || {}, KD = K.devices || {}, me = M.store && M.store.deviceId;
    const ids = [...new Set([...Object.keys(D), ...Object.keys(KD), me].filter(Boolean))];
    return ids.map((id) => {
      const d = D[id] || {}, k = KD[id] || {}, name = d.name || k.name || id;
      const mode = k.on ? (k.wall ? 'vegg' : 'kiosk') : 'vanlig';
      const icon = /ipad|nettbrett|tablet/i.test(name) ? 'mdi:tablet' : /tv/i.test(name) ? 'mdi:television' : /mac|windows|linux|pc/i.test(name) ? 'mdi:laptop' : 'mdi:cellphone';
      return { id, name, icon, sub: id === me ? T('Denne enheten', 'This device') : (d.seen ? `${T('Sist sett', 'Last seen')} ${M.relTime ? M.relTime(new Date(d.seen).toISOString()) : ''}` : ''), mode };
    });
  }
  function kioskSet(id, mode, name) {
    const K = { ...(sget('kiosk') || {}) }, cur = { ...((K.devices || {})[id] || {}) };
    if (mode === 'vanlig') { cur.on = false; delete cur.wall; } else { cur.on = true; cur.hide = cur.hide && cur.hide.length ? cur.hide : ['kiosk']; cur.when = 'always'; if (mode === 'vegg') cur.wall = true; else delete cur.wall; }
    cur.name = cur.name || name;
    sset('kiosk', setP(K, 'devices.' + id, cur));
  }
  // Teknisk utseende navn (Fiks 25.3 · «Rydd opp i navn»): understrek, hex-ID-er, store bokstaver med bindestrek
  const TECH = /_|\b0x[0-9a-fA-F]{4,}\b|\b(?=[0-9a-fA-F]*\d)[0-9a-fA-F]{8,}\b|^[A-Z0-9]{2,}[-_][A-Z0-9-]+$/; // ikke /i: «Alle lys» er et vanlig navn
  const TYPE = { light: 'lampe', switch: 'bryter', climate: 'termostat', media_player: 'mediaspiller', fan: 'vifte', cover: 'gardin', lock: 'lås', camera: 'kamera', vacuum: 'robotstøvsuger' };
  const DC = { temperature: 'temperatur', humidity: 'luftfukt', motion: 'bevegelse', occupancy: 'tilstedeværelse', door: 'dør', window: 'vindu', battery: 'batteri', power: 'effekt', energy: 'energi', illuminance: 'lysstyrke' };
  TPS.niceName = function (h, id, raw) {
    if (!raw || !TECH.test(raw)) return raw;
    const s = h && h.states[id], dom = String(id).split('.')[0], dc = s && s.attributes.device_class;
    const kind = DC[dc] || TYPE[dom];
    const a = areaOf(h, id), an = a && h.areas && h.areas[a] ? h.areas[a].name : '';
    if (!kind) return raw.replace(/_/g, ' ');
    return an ? `${an} ${kind}` : kind.charAt(0).toUpperCase() + kind.slice(1);
  };
  // MSH.name: «Rydd opp i navn» (tilpass.clean, standard på) og «Kortere navn inne i rom» (tilpass.strip, standard på)
  if (M.name && !M.name.__tps) {
    const orig = M.name;
    M.name = function (hass, id, strip) {
      const c = (M.store && M.store.get('tilpass')) || {};
      let n = orig.call(this, hass, id, c.strip === false ? undefined : strip);
      if (c.clean !== false && hass && id) {
        const raw = (MSH.st(hass, id) || { attributes: {} }).attributes.friendly_name;
        if (raw && raw === n && TECH.test(raw)) { n = TPS.niceName(hass, id, raw); if (strip && c.strip !== false) { const r = new RegExp('^' + String(strip).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s+', 'i'); const s2 = n.replace(r, ''); n = s2 ? s2.charAt(0).toUpperCase() + s2.slice(1) : n; } }
      }
      return n;
    };
    M.name.__tps = true;
  }

  /* ------------------------------------------------------------ oppsummeringer (hub-radene, søk) */
  function summaries(h) {
    const c = tp(), A = ACC[c.theme] || ACC.rosa, B = BGS[c.bg] || BGS.grafitt;
    const R = roomsModel(h), P = personsModel(h), NV = navModel(), POP = popupModel(h), V = TPS.vars(), KD = kioskModel();
    const lang = window.kiLang ? window.kiLang() : 'no';
    const hc = hdr(), greet = greetMode(hc), chips = chipsOf(hc);
    const TT = h && M.hjemAllTabs ? M.hjemAllTabs(h, fan()) : [], hb = homeBlocks();
    const bar = NV.list.filter((x) => x.on).slice(0, 5);
    return {
      tema: `${A[0]} · ${B[0]} · ${c.density === 'kompakt' ? 'Kompakt' : 'Luftig'}`,
      sprak: `${lang === 'en' ? 'English' : 'Bokmål'} · ${c.clean !== false ? T('Ryddige navn', 'Tidy names') : T('Originale navn', 'Original names')}`,
      header: `«${greetPreview(hc)}»${chips.length ? ' · ' + chips.map((k) => (CHIPS.find((x) => x[0] === k) || [])[2]).join(', ') : ''}`,
      kort: `${TT.filter((t) => !t.hidden).map((t) => t.label).join(', ')} · ${hb.filter((x) => x.on).length} ${T('av', 'of')} ${hb.length} ${T('kort', 'cards')}`,
      navbar: `${nav().dock === 'fast' ? 'Fast i bunnen' : 'Svevende'} · ${bar.map((x) => x.label).join(', ')}`,
      rom: `${R.filter((r) => r.on).length} ${T('av', 'of')} ${R.length} ${T('rom', 'rooms')} · ${R.filter((r) => r.fav).length} ${T('på Hjem-fanen', 'on the Home tab')}`,
      personer: P.filter((p) => p.on).map((p) => p.name).join(', ') || T('Ingen vises', 'None shown'),
      popups: `${POP.filter((p) => p.on).length} ${T('av', 'of')} ${POP.length} ${T('er på', 'are on')}`,
      var: `${T('Dyr strøm over', 'Expensive power above')} ${fV(V.dyr, 'kr')} · ${T('Komfort', 'Comfort')} ${fV(V.komfort, '°')}`,
      kiosk: `${KD.length} ${T('skjermer', 'screens')} · ${KD.filter((d) => d.mode !== 'vanlig').length} ${T('i kiosk', 'in kiosk')}`,
      greet,
    };
  }
  function greetMode(c) { const g = c.greeting; return g == null || g === '👋 {name}!' ? 'vink' : g === '{tid}, {name}' ? 'tid' : 'fast'; }
  function greetPreview(c) {
    const h = hassNow(), first = String(((h || {}).user || {}).name || '').split(' ')[0] || 'deg', g = c.greeting != null ? c.greeting : '👋 {name}!';
    return String(g).replace(/\{tid\}/g, M.hjemTimeGreeting ? M.hjemTimeGreeting() : 'Hei').replace(/\{(name|user|first_name)\}/g, first).replace(/\{[a-z_]+\}/g, '').trim();
  }
  function chipsOf(c) {
    const u = String(c.undertekst || '');
    return CHIPS.filter((x) => u.includes(x[3].split(' ')[0])).map((x) => x[0]);
  }
  function homeBlocks() {
    const c = home(), hid = new Set(Array.isArray(c.hidden) ? c.hidden : []), ord = Array.isArray(c.order) ? c.order.filter((k) => HOMEK.includes(k)) : [];
    const O = [...ord, ...HOMEK.filter((k) => !ord.includes(k))], X = tp().cards || {};
    return O.map((k) => ({ id: k, icon: HOMEB[k][0], label: (X[k] || {}).label || HOMEB[k][1], size: (X[k] || {}).size || 'stor', when: (X[k] || {}).when || 'alltid', on: !hid.has(k) }));
  }
  const homeWrite = (list) => homeSet({ order: list.map((x) => x.id), hidden: list.filter((x) => !x.on).map((x) => x.id) });

  /* ------------------------------------------------------------ felles CSS (designets mål, tema-tokens med designets fallback) */
  const A_ = 'var(--ki-accent, rgb(242 133 201))', GRAD_ = 'var(--ki-grad, linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%))';
  const BG_ = 'var(--ki-bg, #232323)', CARD_ = 'var(--ki-surface, #2e2e2e)', ROW_ = 'var(--ki-surface-2, #3a3a3a)';
  const SOFT_ = `color-mix(in srgb, ${A_} 18%, transparent)`;
  const CSS = `
    :host{font-family:${M.FONT};color:var(--ki-text, #fafafa)}
    .sh.tp{background:${BG_}!important}
    .body{gap:16px!important;padding:0 0 150px}
    .top{position:sticky;top:0;z-index:3;background:${BG_};display:flex;flex-direction:column;gap:12px;padding:8px 0 10px;margin:0 -2px}
    .hrow{display:flex;align-items:center;gap:12px;padding:0 4px}
    .ht{flex:1;font-size:30px;font-weight:600;letter-spacing:-.02em}
    .rb{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;background:${ROW_};color:inherit}
    .rb ha-icon{--mdc-icon-size:22px}
    .sr{display:flex;align-items:center;gap:10px;height:48px;padding:0 6px 0 16px;border-radius:24px;background:${ROW_}}
    .sr input{flex:1;min-width:0;height:44px;border:0;outline:0;background:transparent;font-size:15px;color:inherit;font-family:inherit}
    .mut{color:var(--ki-text-2, #a8a8a8)}
    .dt{display:flex;align-items:center;gap:12px;padding:6px 0 10px}
    .dtt{flex:1;min-width:0;font-size:21px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sv{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ki-text-2, #a8a8a8)}
    .sv ha-icon{--mdc-icon-size:18px}.sv.on ha-icon{color:${A_}}.sv.busy ha-icon{animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .gl{font-size:13px;color:var(--ki-text-2, #a0a0a0);padding:0 6px}
    .col{display:flex;flex-direction:column;gap:8px}
    .card{display:flex;flex-direction:column;background:${CARD_};border-radius:24px;overflow:hidden}
    .it{width:100%;display:flex;align-items:center;gap:14px;padding:10px 12px 10px 14px;min-height:68px;box-sizing:border-box;text-align:left;color:inherit;background:none;border:0;font:inherit;cursor:pointer}
    .it+.it{border-top:1px solid ${M.theme ? M.theme.whiteA(0.06) : 'rgb(255 255 255/.06)'}}
    .it.lk{opacity:.55}
    .ii{width:40px;height:40px;border-radius:14px;background:${SOFT_};color:${A_};display:grid;place-items:center;flex:none}
    .ii ha-icon{--mdc-icon-size:22px}
    .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .tx b{font-size:16px;font-weight:500}
    .tx i{font-style:normal;font-size:13px;color:var(--ki-text-2, #a0a0a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .chev{color:var(--ki-text-3, #7a7a7a);flex:none;display:flex}
    .sc2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .scb{display:flex;flex-direction:column;align-items:flex-start;gap:14px;padding:16px;border-radius:24px;background:${CARD_};text-align:left;color:inherit;border:0;font:inherit;cursor:pointer}
    .scb .sci{width:40px;height:40px;border-radius:20px;display:grid;place-items:center}
    .scb b{font-size:15px;font-weight:500}.scb i{font-style:normal;font-size:12px;color:var(--ki-text-2, #a0a0a0);line-height:1.35}
    .gi{background:${GRAD_};color:var(--ki-on-accent, #2f2f2f)}
    .foot{font-size:13px;color:var(--ki-text-3, #8e8e8e);text-align:center;padding:0 20px;line-height:1.45}
    .red{color:var(--ki-red-text, #f4a196)}
    .sw{width:44px;height:26px;border-radius:13px;background:var(--ki-ctrl, #555);position:relative;display:block;flex:none;transition:background .2s}
    .sw::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:10px;background:var(--ki-knob, #fff);box-shadow:0 1px 3px rgb(0 0 0/.3);transition:transform .2s}
    .sw.on{background:${A_}}.sw.on::after{transform:translateX(18px)}
    .seg{display:flex;gap:2px;padding:4px;border-radius:24px;background:${ROW_}}
    .seg button{flex:1;min-width:0;height:40px;border-radius:20px;font-size:14px;font-weight:500;white-space:nowrap;padding:0 8px;background:transparent;color:var(--ki-text-2, #c8c8c8);transition:background .2s,color .2s;border:0;font-family:inherit;cursor:pointer}
    .seg button.on{background:var(--ki-pill-bg, #f2f2f2);color:var(--ki-pill-fg, #232323)}
    .rows{display:flex;flex-direction:column;gap:6px}
    .rw{display:flex;align-items:center;min-height:58px;border-radius:29px;background:${ROW_};position:relative;transition:transform .2s ease,opacity .2s}
    .rw.off{opacity:.5}
    .rw.drag{transition:none;z-index:3;box-shadow:0 12px 30px rgb(0 0 0/.45)}
    .hd{width:40px;height:58px;flex:none;display:grid;place-items:center;touch-action:none;cursor:grab;color:var(--ki-text-3, #8a8a8a);background:none;border:0}
    .rwb{flex:1;min-width:0;display:flex;align-items:center;gap:12px;min-height:58px;text-align:left;color:inherit;background:none;border:0;font:inherit;cursor:pointer;padding:0}
    .ri{width:38px;height:38px;border-radius:19px;flex:none;display:grid;place-items:center;background:${SOFT_};color:${A_}}
    .rw.off .ri{background:${M.theme ? M.theme.whiteA(0.06) : 'rgb(255 255 255/.06)'};color:var(--ki-text-mid, #9a9a9a)}
    .ri ha-icon{--mdc-icon-size:20px}
    .rt{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .rt b{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .rt i{font-style:normal;font-size:12px;color:var(--ki-text-2, #a0a0a0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ib{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;color:var(--ki-text-2, #c8c8c8);background:none;border:0;cursor:pointer}
    .ib ha-icon{--mdc-icon-size:22px}
    .tg{width:58px;height:58px;flex:none;display:grid;place-items:center;background:none;border:0;cursor:pointer}
    .star{color:var(--ki-text-3, #6a6a6a)}.star.on{color:${A_}}
    .pv{background:${BG_};border-radius:28px;padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:0 0 0 1px ${M.theme ? M.theme.whiteA(0.1) : 'rgb(255 255 255/.1)'} inset}
    .sw5{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px}
    .swb{display:flex;flex-direction:column;align-items:center;gap:8px;padding:6px 0;background:none;border:0;color:inherit;font:inherit;cursor:pointer}
    .dot{width:48px;height:48px;border-radius:24px;transition:box-shadow .2s}
    .swb span:last-child{font-size:12px;color:var(--ki-text-2, #a0a0a0)}.swb.on span:last-child{color:var(--ki-text, #fafafa)}
    .bg3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .bgt{display:flex;flex-direction:column;align-items:center;gap:8px;background:none;border:0;color:inherit;font:inherit;cursor:pointer}
    .bgt .bx{width:100%;box-sizing:border-box;border-radius:22px;padding:10px;display:flex;flex-direction:column;gap:8px}
    .bgt .bc{height:34px;border-radius:12px}.bgt .br{height:12px;width:60%;border-radius:6px}
    .bgt>span:last-child{font-size:13px;color:var(--ki-text-2, #a0a0a0)}.bgt.on>span:last-child{color:var(--ki-text, #fafafa)}
    .chips{display:flex;flex-wrap:wrap;gap:6px}
    .chip{display:flex;align-items:center;gap:6px;height:44px;padding:0 16px 0 12px;border-radius:22px;font-size:14px;font-weight:500;background:${ROW_};color:var(--ki-text-2, #d0d0d0);border:0;font-family:inherit;cursor:pointer}
    .chip ha-icon{--mdc-icon-size:18px}
    .chip.on{background:${SOFT_};color:${A_};box-shadow:0 0 0 1.5px ${A_} inset}
    .hc{display:flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:16px;background:${ROW_};font-size:13px}
    .hc ha-icon{--mdc-icon-size:16px;color:${A_}}
    .in{height:52px;padding:0 18px;border-radius:26px;border:0;outline:0;background:${ROW_};font-size:16px;color:inherit;font-family:inherit;box-sizing:border-box;width:100%}
    .vt{display:flex;flex-direction:column;gap:6px;padding:14px 16px}
    .vt+.vt{border-top:1px solid ${M.theme ? M.theme.whiteA(0.06) : 'rgb(255 255 255/.06)'}}
    .vh{display:flex;align-items:baseline;justify-content:space-between;gap:10px}.vh b{font-size:15px;font-weight:500}.vh span{font-size:22px;font-weight:500;font-variant-numeric:tabular-nums}
    .vt small{font-size:12px;color:var(--ki-text-mid, #9a9a9a)}
    .mono{font-size:12px;color:var(--ki-text-3, #8a8a8a);font-family:ui-monospace,monospace}
    .note{display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:18px;font-size:13px}.note ha-icon{--mdc-icon-size:18px}
    .dv{display:flex;flex-direction:column;gap:12px;padding:14px;border-radius:26px;background:${CARD_}}
    .dvh{display:flex;align-items:center;gap:12px}
    .nm{display:flex;flex-direction:column;gap:2px;padding:12px 16px}.nm+.nm{border-top:1px solid ${M.theme ? M.theme.whiteA(0.06) : 'rgb(255 255 255/.06)'}}.nm b{font-size:15px;font-weight:500}.nm i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #9a9a9a)}
    .add{height:52px;border-radius:26px;border:1.5px dashed ${M.theme ? M.theme.whiteA(0.22) : 'rgb(255 255 255/.22)'};display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:500;background:none;color:inherit;font-family:inherit;cursor:pointer}
    .av{width:40px;height:40px;border-radius:20px;flex:none;color:var(--ki-on-accent, #232323);font-weight:600;font-size:17px;display:grid;place-items:center;background-size:cover;background-position:center}
    .navp{background:${BG_};border-radius:28px;padding:28px 12px;display:flex;justify-content:center;box-shadow:0 0 0 1px ${M.theme ? M.theme.whiteA(0.1) : 'rgb(255 255 255/.1)'} inset}
    .navb{display:flex;align-items:center;gap:2px;padding:6px;border-radius:32px;background:${ROW_};box-shadow:0 10px 30px rgb(0 0 0/.35)}
    .navb span{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:48px;height:48px;border-radius:26px;color:var(--ki-text-1, #e0e0e0)}
    .navb span ha-icon{--mdc-icon-size:22px}.navb.nm span{min-width:54px;height:52px}.navb small{font-size:10px}
    .tb{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:58px;padding:0 10px 0 18px;border-radius:29px;background:${ROW_};text-align:left;color:inherit;border:0;font:inherit;cursor:pointer}
    .tb span:first-child{flex:1;font-size:15px;font-weight:500}
    .cta{position:sticky;bottom:0;margin:0 -2px;padding:16px 0 calc(26px + env(safe-area-inset-bottom, 0px));display:flex;flex-direction:column;gap:4px;background:linear-gradient(to top, ${BG_} 70%, transparent);z-index:4}
    .cta button{height:56px;border-radius:28px;background:${GRAD_};color:var(--ki-on-accent, #2f2f2f);font-size:17px;font-weight:600;border:0;font-family:inherit;cursor:pointer}
    .cta button.alt{height:44px;background:none;font-size:14px;font-weight:400;color:var(--ki-text-2, #c8c8c8)}
    .wh{display:flex;flex-direction:column;gap:8px;padding:4px 4px 0}.wh b{font-size:28px;font-weight:600;letter-spacing:-.02em}.wh span{font-size:15px;color:var(--ki-text-2, #b4b4b4);line-height:1.45}
    .big{display:flex;flex-direction:column;gap:24px;padding:30px 4px 0}
    .bigi{width:72px;height:72px;border-radius:24px;display:grid;place-items:center}.bigi ha-icon{--mdc-icon-size:38px}
    .bigt{display:flex;flex-direction:column;gap:10px}.bigt b{font-size:36px;font-weight:600;letter-spacing:-.03em;line-height:1.05}.bigt span{font-size:16px;line-height:1.45;color:var(--ki-text-2, #b4b4b4)}
    .fnd{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .fnd div{background:${CARD_};border-radius:22px;padding:16px 14px;display:flex;flex-direction:column;gap:2px}.fnd b{font-size:30px;font-weight:500;letter-spacing:-.02em}.fnd span{font-size:13px;color:var(--ki-text-2, #a8a8a8)}
    .mk{display:flex;flex-direction:column;background:${CARD_};border-radius:24px;padding:10px 16px}
    .mk div{display:flex;align-items:center;gap:12px;min-height:44px;font-size:15px}.mk ha-icon{--mdc-icon-size:20px;color:${A_}}
    .wz{display:flex;align-items:center;gap:12px;padding:6px 0 10px}.wzm{flex:1;display:flex;flex-direction:column;gap:7px}.wzm span{font-size:13px;color:var(--ki-text-2, #a8a8a8)}
    .segs{display:flex;gap:4px}.segs i{flex:1;height:4px;border-radius:2px;background:${M.theme ? M.theme.whiteA(0.14) : 'rgb(255 255 255/.14)'};transition:background .3s}.segs i.on{background:${A_}}
    .skip{height:44px;padding:0 6px;font-size:14px;color:var(--ki-text-2, #c8c8c8);background:none;border:0;font-family:inherit;cursor:pointer}
    .dn{display:flex;align-items:center;gap:12px;padding:12px 12px 12px 16px;min-height:68px;box-sizing:border-box}.dn+.dn{border-top:1px solid ${M.theme ? M.theme.whiteA(0.06) : 'rgb(255 255 255/.06)'}}
    .dn .tx b{font-size:16px}.dn .tx i{font-size:13px}
    .eb{height:40px;padding:0 16px;border-radius:20px;background:${ROW_};font-size:14px;font-weight:500;border:0;color:inherit;font-family:inherit;cursor:pointer}
    .hint{display:flex;align-items:center;gap:10px;padding:12px 8px 12px 16px;border-radius:22px;background:${SOFT_};color:${A_};font-size:14px}
    .hint span{flex:1}
    button{-webkit-tap-highlight-color:transparent}
    button:active{transform:scale(.97)}
    @media (prefers-reduced-motion: reduce){.rw,.sw,.sw::after,.seg button{transition:none}}
  `;

  /* ------------------------------------------------------------ dra for å endre rekkefølge (peker: touch og mus) */
  // rows: radene i én liste (samme forelder); onDrop(fra, til) kalles når raden slippes på ny plass
  function dragList(root, sel, onDrop) {
    root.addEventListener('pointerdown', (e) => {
      const hd = e.target.closest && e.target.closest('.hd');
      if (!hd || !root.contains(hd)) return;
      const row = hd.closest(sel), list = row && row.parentElement;
      if (!row || !list) return;
      e.preventDefault(); e.stopPropagation();
      const rows = [...list.querySelectorAll(':scope > ' + sel)], from = rows.indexOf(row), H = row.getBoundingClientRect().height + 6, y0 = e.clientY;
      row.classList.add('drag'); M.haptic('medium');
      let to = from;
      const mv = (ev) => {
        ev.preventDefault();
        const dy = ev.clientY - y0; to = Math.max(0, Math.min(rows.length - 1, from + Math.round(dy / H)));
        row.style.transform = `translateY(${dy}px) scale(1.02)`;
        rows.forEach((r, i) => { if (r === row) return; let y = 0; if (from < to && i > from && i <= to) y = -H; if (from > to && i >= to && i < from) y = H; r.style.transform = y ? `translateY(${y}px)` : ''; });
      };
      const up = () => {
        window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
        rows.forEach((r) => { r.style.transform = ''; }); row.classList.remove('drag');
        if (to !== from) onDrop(from, to, list);
      };
      window.addEventListener('pointermove', mv, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    }, true);
    ['touchstart', 'touchmove'].forEach((t) => root.addEventListener(t, (e) => { if (e.target.closest && e.target.closest('.hd')) e.stopPropagation(); }, { passive: true }));
  }
  const moveArr = (a, from, to) => { const b = [...a]; const [x] = b.splice(from, 1); b.splice(to, 0, x); return b; };

  /* ------------------------------------------------------------ byggeklosser */
  const sw = (on) => `<span class="sw${on ? ' on' : ''}"></span>`;
  const seg = (a, opts, cur, extra) => `<div class="seg">${opts.map(([v, l]) => `<button class="${String(v) === String(cur) ? 'on' : ''}" data-a="${a}" data-v="${esc(v)}"${extra || ''}>${esc(l)}</button>`).join('')}</div>`;
  const row = (o) => `<div class="rw${o.on === false ? ' off' : ''}" data-key="${esc(o.key)}"${o.attrs || ''}>${o.drag ? `<button class="hd" title="${esc(T('Dra', 'Drag'))}">${ic('mdi:drag-vertical', 22)}</button>` : ''}
      <button class="rwb" ${o.open ? `data-a="${o.open}" data-v="${esc(o.id)}"` : 'tabindex="-1"'} style="${o.drag ? '' : 'padding-left:10px'}">${o.av || `<span class="ri">${ic(o.icon, 20)}</span>`}<span class="rt"><b ${o.noTr ? 'data-noi18n' : ''}>${esc(o.label)}</b>${o.sub != null ? `<i ${o.subNoTr ? 'data-noi18n' : ''}>${esc(o.sub)}</i>` : ''}${o.mono ? `<span class="mono" data-noi18n>${esc(o.mono)}</span>` : ''}</span></button>
      ${o.tail || ''}</div>`;
  const savedHtml = () => `<span class="sv ${TPS.saving ? 'busy' : 'on'}">${ic(TPS.saving ? 'mdi:loading' : 'mdi:cloud-check-outline', 18)}${esc(TPS.saving ? T('Lagrer…', 'Saving…') : T('Lagret', 'Saved'))}</span>`;
  const detTop = (k) => `<div class="top"><div class="dt"><button class="rb" data-a="back" title="${esc(T('Tilbake', 'Back'))}">${ic('mdi:arrow-left', 22)}</button><span class="dtt">${esc(META[k][1])}</span>${savedHtml()}</div></div>`;

  /* ------------------------------------------------------------ sidene */
  const PAGES = {};
  PAGES.hub = (st, h) => {
    const S = summaries(h), q = String(st.q || '').trim().toLowerCase();
    const item = (k) => { const L = locked(k); return `<button class="it${L ? ' lk' : ''}" data-a="${L ? 'locked' : 'open'}" data-v="${k}"><span class="ii">${ic(L ? 'mdi:lock-outline' : META[k][0], 22)}</span><span class="tx"><b>${esc(META[k][1])}</b><i data-noi18n>${esc(L ? T('Låst av installatøren', 'Locked by the installer') : S[k])}</i></span><span class="chev">${ic('mdi:chevron-right', 22)}</span></button>`; };
    const top = `<div class="top"><div class="hrow"><span class="ht">${esc(T('Tilpass', 'Customize'))}</span><button class="rb" data-a="close" title="${esc(T('Lukk', 'Close'))}">${ic('mdi:close', 22)}</button></div>
      <div class="sr"><span class="mut" style="display:flex">${ic('mdi:magnify', 20)}</span><input data-in="q" value="${esc(st.q || '')}" placeholder="${esc(T('Søk, f.eks. strømpris eller navbar', 'Search, e.g. power price or navbar'))}" autocomplete="off">${q ? `<button class="ib" data-a="clearq" title="${esc(T('Tøm', 'Clear'))}" style="width:36px;height:36px">${ic('mdi:close-circle', 20)}</button>` : ''}</div></div>`;
    if (q) {
      const res = Object.keys(META).filter((k) => (META[k][1] + ' ' + T(META[k][1], META[k][1]) + ' ' + META[k][2] + ' ' + S[k]).toLowerCase().includes(q));
      return top + (res.length ? `<div class="card">${res.map(item).join('')}</div>` : `<span class="mut" style="font-size:15px;padding:24px 4px;text-align:center">${esc(T('Fant ingenting for', 'Found nothing for'))} «<span data-noi18n>${esc(st.q)}</span>». ${esc(T('Prøv «farge», «rom» eller «temperatur».', 'Try “colour”, “room” or “temperature”.'))}</span>`);
    }
    const pro = proOn(), c = tp();
    return top + `<div class="sc2">
        <button class="scb" data-a="edithome"><span class="sci gi">${ic('mdi:gesture-tap-hold', 22)}</span><span class="tx"><b>${esc(T('Rediger på Hjem', 'Edit on Home'))}</b><i>${esc(T('Hold inne et kort', 'Press and hold a card'))}</i></span></button>
        <button class="scb" data-a="wizard"><span class="sci" style="background:${ROW_}">${ic('mdi:auto-fix', 22)}</span><span class="tx"><b>${esc(T('Veiviser', 'Wizard'))}</b><i>${esc(T('Rom, personer og tema', 'Rooms, people and theme'))}</i></span></button></div>`
      + GROUPS.map(([label, keys]) => `<div class="col"><span class="gl">${esc(label)}</span><div class="card">${keys.map(item).join('')}</div></div>`).join('')
      + sysGroup()
      + `<div class="col"><span class="gl">${esc(T('For installatør', 'For installers'))}</span><div class="card">
        ${isAdmin() ? `<button class="it" data-a="pro"><span class="tx"><b>${esc(T('Installatørmodus', 'Installer mode'))}</b><i>${esc(T('Viser tekniske navn, entiteter og eksport', 'Shows technical names, entities and export'))}</i></span>${sw(pro)}</button>` : ''}
        ${pro ? `<button class="it" data-a="lock"><span class="tx"><b>${esc(T('Lås for kunden', 'Lock for the customer'))}</b><i>${esc(T('Kunden kan bare endre tema og kort', 'The customer can only change the theme and cards'))}</i></span>${sw(!!c.lock)}</button>
          <button class="it" data-a="export" style="min-height:60px"><span class="mut" style="display:flex">${ic('mdi:upload', 22)}</span><span class="tx"><b style="font-weight:400">${esc(T('Eksporter oppsett', 'Export setup'))}</b></span></button>
          <button class="it" data-a="import" style="min-height:60px"><span class="mut" style="display:flex">${ic('mdi:download', 22)}</span><span class="tx"><b style="font-weight:400">${esc(T('Importer oppsett', 'Import setup'))}</b></span></button>` : ''}
        <button class="it red" data-a="reset" style="min-height:60px"><span style="display:flex">${ic('mdi:restart', 22)}</span><span class="tx"><b style="font-weight:400">${esc(T('Tilbakestill alt', 'Reset everything'))}</b></span></button>
      </div></div><span class="foot">${esc(T('Endringer lagres med en gang, og du kan alltid angre.', 'Changes are saved right away, and you can always undo.'))}</span>`;
  };
  // Utenfor fasiten: det gamle Mer → Tilpass-arket hadde også PC-dashbordet, Enheter og Home Assistant – de må fortsatt nås
  function sysGroup() {
    const nb = M.liveOf && M.liveOf('msh-navbar-card'), it = [];
    if (M.pc) it.push(['pc', 'mdi:monitor', T('Dashbord på PC', 'Dashboard on PC'), M.pc.mode() === 'pc' ? T('Oversikt for PC', 'Overview for PC') : T('Mobilvisning', 'Mobile view')]);
    if (M.store && M.store.devices && nb && nb._devicesSheet) { const n = M.store.devices().filter((d) => d.own > 0).length; it.push(['devices', 'mdi:devices', T('Enheter', 'Devices'), n ? `${n} ${n === 1 ? T('enhet med eget oppsett', 'device with its own setup') : T('enheter med eget oppsett', 'devices with their own setup')}` : T('Gi nytt navn, nullstill eller slett', 'Rename, reset or delete')]); }
    if (M.ha && isAdmin()) it.push(['ha', 'mdi:home-assistant', 'Home Assistant', T('Automasjoner, scener, oppdateringer og backup', 'Automations, scenes, updates and backup')]);
    if (!it.length) return '';
    return `<div class="col"><span class="gl">${esc(T('Enheter og system', 'Devices and system'))}</span><div class="card">${it.map(([k, i, t, sub]) => `<button class="it" data-a="sys" data-v="${k}"><span class="ii">${ic(i, 22)}</span><span class="tx"><b>${esc(t)}</b><i>${esc(sub)}</i></span><span class="chev">${ic('mdi:chevron-right', 22)}</span></button>`).join('')}</div></div>`;
  }
  // Tema-forhåndsvisning (hilsen, to romkort, navbar) – samme i siden og i veiviseren
  function themePreview(h) {
    const R = roomsModel(h), fav = R.filter((r) => r.on && r.fav), sh = (fav.length ? fav : R.filter((r) => r.on)).slice(0, 2), NV = navModel().list.filter((x) => x.on).slice(0, 5);
    return `<div class="pv"><div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:20px;font-weight:600" data-noi18n>${esc(greetPreview(hdr()))}</span></div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--ki-gap, 12px)">${sh.map((r) => `<div style="background:${CARD_};border-radius:var(--ki-radius, 26px);padding:12px;display:flex;flex-direction:column;gap:10px"><span style="width:32px;height:32px;border-radius:16px;background:${SOFT_};color:${A_};display:grid;place-items:center">${ic(r.icon, 18)}</span><span style="display:flex;flex-direction:column"><span style="font-size:13px;font-weight:500" data-noi18n>${esc(r.name)}</span><span class="mut" style="font-size:12px">${r.temp != null ? nf(r.temp, 1) + '°' : '–'}</span></span></div>`).join('')}</div>
      <div style="display:flex;justify-content:center"><div style="display:flex;gap:4px;padding:5px;border-radius:24px;background:${ROW_}">${NV.map((n) => `<span style="width:34px;height:34px;border-radius:17px;display:grid;place-items:center;color:var(--ki-text-1, #d0d0d0)">${ic(n.icon, 18)}</span>`).join('')}</div></div></div>`;
  }
  function themeControls() {
    const c = tp(), th = c.theme || 'rosa', bg = c.bg || 'grafitt';
    return `<div class="col"><span class="gl">${esc(T('Farge', 'Colour'))}</span><div class="sw5">${Object.entries(ACC).map(([k, [n, a, b]]) => `<button class="swb${th === k ? ' on' : ''}" data-a="theme" data-v="${k}"><span class="dot" style="background:linear-gradient(145deg, ${a} -10%, ${b} 100%);${th === k ? `box-shadow:0 0 0 3px ${BG_}, 0 0 0 5px ${a}` : ''}"></span><span>${esc(n)}</span></button>`).join('')}</div></div>
      <div class="col"><span class="gl">${esc(T('Bakgrunn', 'Background'))}</span><div class="bg3">${Object.entries(BGS).map(([k, [n, b1, b2, b3]]) => `<button class="bgt${bg === k ? ' on' : ''}" data-a="bg" data-v="${k}"><span class="bx" style="background:${b1};box-shadow:${bg === k ? `0 0 0 2px ${A_}` : `0 0 0 1px ${M.theme ? M.theme.whiteA(0.14) : 'rgb(255 255 255/.14)'}`}"><span class="bc" style="background:${b2}"></span><span class="br" style="background:${b3}"></span></span><span>${esc(n)}</span></button>`).join('')}</div></div>
      <div class="col"><span class="gl">${esc(T('Tetthet', 'Density'))}</span>${seg('density', [['luftig', 'Luftig'], ['kompakt', 'Kompakt']], c.density || 'luftig')}</div>
      <div class="col"><span class="gl">${esc(T('Hjørner', 'Corners'))}</span>${seg('corner', [['rund', 'Runde'], ['myk', 'Mindre runde']], c.corner || 'rund')}</div>`;
  }
  PAGES.tema = (st, h) => detTop('tema') + themePreview(h) + themeControls();
  PAGES.sprak = (st, h) => {
    const c = tp(), lang = window.kiLang ? window.kiLang() : 'no', pro = proOn();
    const ents = h ? Object.keys(h.states).filter((id) => /^(light|switch|sensor|climate|media_player|fan|cover)\./.test(id) && TECH.test(String((h.states[id].attributes || {}).friendly_name || ''))).slice(0, 5) : [];
    return detTop('sprak') + `<div class="col"><span class="gl">${esc(T('Språk', 'Language'))}</span>${seg('lang', [['nb', 'Bokmål'], ['nn', 'Nynorsk'], ['en', 'English']], lang === 'en' ? 'en' : 'nb')}</div>
      <div class="card"><button class="it" data-a="clean"><span class="tx"><b>${esc(T('Rydd opp i navn', 'Tidy up names'))}</b><i>${esc(T('Gjør «Stue_Tak 2» om til «Stue taklampe»', 'Turns “Stue_Tak 2” into “Living room ceiling lamp”'))}</i></span>${sw(c.clean !== false)}</button>
        <button class="it" data-a="strip"><span class="tx"><b>${esc(T('Kortere navn inne i rom', 'Shorter names inside rooms'))}</b><i>${esc(T('«Stue taklampe» blir «Taklampe» i Stue', '“Living room lamp” becomes “Lamp” in the living room'))}</i></span>${sw(c.strip !== false)}</button></div>
      <div class="col"><span class="gl">${esc(T('Slik ser navnene ut', 'This is how names look'))}</span><div class="card">${ents.length ? ents.map((id) => { const raw = h.states[id].attributes.friendly_name, a = areaOf(h, id), an = a && h.areas[a] ? h.areas[a].name : ''; const shown = c.clean !== false ? (c.strip !== false && an ? M.name(h, id, an) : M.name(h, id)) : raw; return `<div class="nm"><b data-noi18n>${esc(shown)}</b><i>${an ? `${esc(T('I', 'In'))} <span data-noi18n>${esc(an)}</span>` : ''}${c.clean !== false ? ` · ${esc(T('før', 'before'))}: <span data-noi18n>${esc(raw)}</span>` : ''}</i>${pro ? `<span class="mono" data-noi18n>${esc(id)}</span>` : ''}</div>`; }).join('') : `<div class="nm"><i>${esc(T('Fant ingen tekniske navn – alt ser ryddig ut.', 'Found no technical names – everything looks tidy.'))}</i></div>`}</div></div>`;
  };
  PAGES.header = (st, h) => {
    const c = hdr(), g = greetMode(c), chips = chipsOf(c);
    return detTop('header') + `<div class="pv" style="padding:18px;gap:10px"><span style="font-size:26px;font-weight:600;letter-spacing:-.02em" data-noi18n>${esc(greetPreview(c))}</span><div class="chips">${chips.map((k) => { const x = CHIPS.find((y) => y[0] === k); return `<span class="hc">${ic(x[1], 16)}${esc(x[2])}</span>`; }).join('')}</div></div>
      <div class="col"><span class="gl">${esc(T('Hilsen', 'Greeting'))}</span>${seg('greet', [['vink', 'Vink og navn'], ['tid', 'Etter tiden'], ['fast', 'Egen tekst']], g)}${g === 'fast' ? `<input class="in" data-in="greettext" value="${esc(c.greeting || '')}" placeholder="${esc(T('Skriv hilsenen', 'Write the greeting'))}">` : ''}</div>
      <div class="col"><span class="gl">${esc(T('Vis under hilsenen · velg opptil to', 'Show under the greeting · pick up to two'))}</span><div class="chips">${CHIPS.map(([k, icon, label]) => `<button class="chip${chips.includes(k) ? ' on' : ''}" data-a="chip" data-v="${k}">${ic(icon, 18)}${esc(label)}</button>`).join('')}</div></div>`;
  };
  PAGES.kort = (st, h) => {
    const TT = h && M.hjemAllTabs ? M.hjemAllTabs(h, fan()) : [], R = roomsModel(h), fav = R.filter((r) => r.fav).length, hb = homeBlocks();
    const tsub = (t) => (t.kind === 'hjem' ? `${fav} ${T('rom med stjerne', 'rooms with a star')}` : t.kind === 'aktuelt' ? T('Det som skjer nå', 'What is happening now') : t.kind === 'batterier' ? T('Batterier som er lave', 'Batteries that are low') : `${R.filter((r) => r.tab && r.tab.id === t.id && r.on).length} ${T('rom', 'rooms')}`);
    return detTop('kort') + `<div class="col"><span class="gl">${esc(T('Faner', 'Tabs'))}</span><div class="rows" data-list="tabs">${TT.map((t) => row({ key: 'tb-' + t.id, id: t.id, drag: true, icon: t.kind === 'hjem' ? 'mdi:home' : 'mdi:tab', label: t.label, noTr: t.kind === 'floor', sub: tsub(t), on: !t.hidden, tail: `<button class="ib" data-a="tabeye" data-v="${esc(t.id)}" title="${esc(T('Vis eller skjul', 'Show or hide'))}" style="margin-right:6px">${ic(t.hidden ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 22)}</button>` })).join('')}</div></div>
      <span class="gl">${esc(T('Kort på Hjem-fanen', 'Cards on the Home tab'))}</span>
      <div class="rows" data-list="cards">${hb.map((x) => row({ key: 'hb-' + x.id, id: x.id, drag: true, icon: x.icon, label: x.label, sub: `${x.size === 'stor' ? T('Stor', 'Large') : T('Liten', 'Small')} · ${T(WHEN[x.when], WHEN[x.when])}`, on: x.on, tail: `<button class="ib" data-a="cardeye" data-v="${x.id}" title="${esc(T('Vis eller skjul', 'Show or hide'))}">${ic(x.on ? 'mdi:eye-outline' : 'mdi:eye-off-outline', 22)}</button><button class="ib" data-a="cardsheet" data-v="${x.id}" title="${esc(T('Innstillinger', 'Settings'))}" style="margin-right:6px">${ic('mdi:tune', 22)}</button>` })).join('')}</div>
      <button class="add" data-a="addcard">${ic('mdi:plus', 20)}${esc(T('Legg til kort', 'Add card'))}</button>`;
  };
  PAGES.navbar = (st) => {
    const NV = navModel(), c = NV.c, on = NV.list.filter((x) => x.on), bar = on.slice(0, 5), names = !!c.show_names;
    return detTop('navbar') + `<div class="navp"><div class="navb${names ? ' nm' : ''}">${[...bar, ...(on.length > 5 ? [{ icon: 'mdi:dots-horizontal', label: 'Mer' }] : [])].map((n) => `<span>${ic(n.icon, 22)}${names ? `<small>${esc(n.label)}</small>` : ''}</span>`).join('')}</div></div>
      <div class="col"><span class="gl">${esc(T('Plassering', 'Position'))}</span>${seg('dock', [['float', 'Svevende'], ['fast', 'Fast i bunnen']], c.dock === 'fast' ? 'fast' : 'float')}</div>
      <button class="tb" data-a="navnames"><span>${esc(T('Vis navn under ikonene', 'Show names under the icons'))}</span>${sw(names)}</button>
      <div class="col"><span class="gl">${esc(T('Knapper · de fem første vises i navbaren, resten under Mer', 'Buttons · the first five are in the navbar, the rest under More'))}</span>
      <div class="rows" data-list="nav">${NV.list.map((n) => { const k = on.indexOf(n); return row({ key: 'nv-' + n.id, id: n.id, drag: true, icon: n.icon, label: n.label, sub: !n.on ? T('Skjult', 'Hidden') : k < 5 ? T('I navbaren', 'In the navbar') : T('I Mer-menyen', 'In the More menu'), on: n.on, tail: `<button class="ib" data-a="naveye" data-v="${esc(n.id)}" title="${esc(T('Vis eller skjul', 'Show or hide'))}" style="margin-right:6px">${ic(n.on ? 'mdi:eye-outline' : 'mdi:eye-off-outline', 22)}</button>` }); }).join('')}</div></div>`;
  };
  function roomRows(h, wiz) {
    const R = roomsModel(h), by = roomOrder(h, R), FL = M.floors(h), keys = Object.keys(by);
    const label = (k) => { if (k === '_') return T('Uten etasje', 'No floor'); const t = by[k][0].tab; return t ? t.label : k; };
    const TO = h && M.hjemAllTabs ? M.hjemAllTabs(h, fan()).map((t) => t.id) : [], pos = (k) => { const i = TO.indexOf(k); return i < 0 ? 999 : i; };
    keys.sort((a, b) => (a === '_') - (b === '_') || pos(a) - pos(b) || (FL.findIndex((f) => by[a][0].floor === f.floor_id) - FL.findIndex((f) => by[b][0].floor === f.floor_id)));
    return keys.map((k) => { const L = by[k]; return `<div class="col"><span class="gl" style="display:flex;justify-content:space-between"><span ${k !== '_' ? 'data-noi18n' : ''}>${esc(label(k))}</span><span>${L.filter((r) => r.on).length} ${esc(T('av', 'of'))} ${L.length}</span></span>
      <div class="rows" data-list="rooms" data-tab="${esc(k)}">${L.map((r) => row({ key: 'rm-' + r.id, id: r.id, drag: k !== '_', icon: r.icon, label: r.name, noTr: 1, sub: [r.temp != null ? nf(r.temp, 1) + '°' : '–', r.hum != null ? Math.round(r.hum) + ' %' : null, r.lights ? T('Lys', 'Lights') : null].filter(Boolean).join(' · '), on: r.on, open: wiz ? 'roomtog' : 'roomsheet',
        tail: `<button class="ib star${r.fav ? ' on' : ''}" data-a="roomfav" data-v="${esc(r.id)}" title="${esc(T('På Hjem-fanen', 'On the Home tab'))}" style="width:40px">${ic(r.fav ? 'mdi:star' : 'mdi:star-outline', 22)}</button><button class="tg" data-a="roomtog" data-v="${esc(r.id)}" title="${esc(T('Vis eller skjul', 'Show or hide'))}">${sw(r.on)}</button>` })).join('')}</div></div>`; }).join('')
      + `<span class="mut" style="display:flex;align-items:center;gap:6px;font-size:13px;padding:0 6px"><span style="color:${A_};display:flex">${ic('mdi:star', 16)}</span>${esc(T('Stjerne betyr at rommet også vises på Hjem-fanen.', 'A star means the room is also shown on the Home tab.'))}</span>`;
  }
  PAGES.rom = (st, h) => detTop('rom') + `<span class="mut" style="font-size:14px;padding:0 4px;line-height:1.45">${esc(T('Dra for å endre rekkefølgen. Trykk på et rom for å se hvilke sensorer som brukes.', 'Drag to change the order. Tap a room to see which sensors are used.'))}</span>` + roomRows(h, false);
  function personRows(h) {
    const P = personsModel(h), c = hdr(), pf = prof(), style = (pf.show_name != null ? pf.show_name : c.show_name) ? 'navn' : 'bilde';
    return `<div class="rows" data-list="persons">${P.map((p) => row({ key: 'ps-' + p.id, id: p.id, drag: true, av: `<span class="av" style="background-color:${p.c};${p.pic ? `background-image:url('${esc(p.pic)}')` : ''}">${p.pic ? '' : esc(p.name[0] || '?')}</span>`, label: p.name, noTr: 1, sub: `${T('Følges med', 'Tracked with')} ${p.dev} · ${p.home ? T('Hjemme', 'Home') : T('Borte', 'Away')}`, subNoTr: 1, on: p.on, tail: `<button class="tg" data-a="persontog" data-v="${esc(p.id)}" title="${esc(T('Vis eller skjul', 'Show or hide'))}" style="width:62px">${sw(p.on)}</button>` })).join('')}</div>
      <div class="col"><span class="gl">${esc(T('Vis på Hjem', 'Show on Home'))}</span>${seg('pstyle', [['navn', 'Navn og bilde'], ['bilde', 'Bare bilde']], style)}</div>`;
  }
  PAGES.personer = (st, h) => detTop('personer') + personRows(h);
  PAGES.popups = (st, h) => {
    const L = popupModel(h), pro = proOn();
    return detTop('popups') + `<span class="mut" style="font-size:14px;padding:0 4px;line-height:1.45">${esc(T('Popupene lages ut fra det vi finner i huset. Slår du en av, forsvinner den fra navbaren og Mer.', 'The popups are made from what we find in the house. Turn one off and it disappears from the navbar and More.'))}</span>
      <div class="rows">${L.map((p) => row({ key: 'pp-' + p.key, id: p.key, icon: p.icon, label: p.name, sub: pro ? `${p.reason} · ${p.hash}` : p.reason, on: p.on, tail: `<button class="tg" data-a="poptog" data-v="${esc(p.key)}" title="${esc(T('På eller av', 'On or off'))}" style="width:62px">${sw(p.on)}</button>` })).join('')}</div>`;
  };
  const priceNow = (h) => { try { const P = h && M.powerPrice ? M.powerPrice(h) : null; const v = P ? (P.spotNow != null ? P.spotNow : P.now) : null; return v == null || isNaN(v) ? null : Number(v); } catch (e) { return null; } };
  PAGES.var = (st, h) => {
    const V = TPS.vars(), pro = proOn(), price = priceNow(h);
    const lvl = price == null ? null : price < V.billig ? 'Billig' : price > V.dyr ? 'Dyr' : 'Normal', lc = lvl === 'Billig' ? 'var(--ki-green-text, rgb(102 209 158))' : lvl === 'Dyr' ? 'var(--ki-red-text, rgb(242 128 115))' : 'var(--ki-yellow-text, rgb(242 210 111))';
    return detTop('var') + `<span class="mut" style="font-size:14px;padding:0 4px;line-height:1.45">${esc(T('Disse grensene brukes overalt i dashbordet. Endrer du en verdi her, oppdateres kortene, fargene og varslene med en gang.', 'These limits are used everywhere in the dashboard. Change a value here and the cards, colours and alerts update right away.'))}</span>`
      + VARS.map(([label, items], gi) => `<div class="col"><span class="gl">${esc(label)}</span>${gi === 0 && lvl ? `<div class="note" style="background:color-mix(in srgb, ${lc} 14%, transparent);color:${lc}">${ic('mdi:flash', 18)}${esc(T('Nå', 'Now'))}: ${esc(fV(price, 'kr'))} ${esc(T('per kWh. Det regnes som', 'per kWh. That counts as'))} ${esc(T(lvl.toLowerCase() + ' pris', lvl.toLowerCase() + ' price'))}.</div>` : ''}
        <div class="card">${items.map(([k, l, min, max, step, u, uses, id]) => `<div class="vt"><div class="vh"><b>${esc(l)}</b><span data-noi18n>${esc(fV(V[k], u))}</span></div><input type="range" class="kt-range" data-in="var" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${V[k]}" style="width:100%">${''}<small>${esc(T('Brukes av', 'Used by'))} ${esc(uses)}</small>${pro ? `<span class="mono" data-noi18n>${esc(id)}</span>` : ''}</div>`).join('')}</div></div>`).join('');
  };
  PAGES.kiosk = () => {
    const D = kioskModel();
    return detTop('kiosk') + `<span class="mut" style="font-size:14px;padding:0 4px;line-height:1.45">${esc(T('Velg hvordan dashbordet skal oppføre seg på hver skjerm.', 'Choose how the dashboard behaves on each screen.'))}</span>`
      + (D.length ? D.map((d) => `<div class="dv"><div class="dvh"><span class="ii">${ic(d.icon, 22)}</span><span class="tx"><b data-noi18n>${esc(d.name)}</b><i>${esc(d.sub)}</i></span></div>${seg('kmode', KMODE, d.mode, ` data-k="${esc(d.id)}" data-n="${esc(d.name)}"`)}<span class="mut" style="font-size:13px;line-height:1.4;padding:0 4px">${esc(T(KEXP[d.mode], KEXP[d.mode]))}</span></div>`).join('') : `<span class="mut">${esc(T('Ingen skjermer er sett ennå. Åpne dashbordet på skjermen én gang, så dukker den opp her.', 'No screens seen yet. Open the dashboard on the screen once and it shows up here.'))}</span>`);
  };

  /* ------------------------------------------------------------ ark: rom (sensorer), kort, legg til kort */
  function candidates(h, area, role) {
    const inA = (id) => areaOf(h, id) === area;
    if (role === 'temp') return [...M.byClass(h, 'sensor', 'temperature', area), ...M.all(h, 'climate', (s, id) => inA(id))];
    if (role === 'hum') return M.byClass(h, 'sensor', 'humidity', area);
    if (role === 'lys') return M.all(h, 'light', (s, id) => inA(id));
    if (role === 'bev') return M.all(h, 'binary_sensor', (s, id) => inA(id) && /motion|occupancy|presence/.test(s.attributes.device_class || ''));
    return [];
  }
  const valOf = (h, id) => { const s = h.states[id]; if (!s) return ''; if (id.startsWith('climate.')) return s.attributes.current_temperature != null ? nf(s.attributes.current_temperature, 1) + '°' : ''; const u = s.attributes.unit_of_measurement || ''; return u ? `${M.num(h, id) != null ? nf(M.num(h, id), u === '%' ? 0 : 1) : s.state} ${u}`.trim() : (M.isOn(s) ? T('På', 'On') : T('Av', 'Off')); };
  const srcOf = (h, id) => { const e = h.entities && h.entities[id]; return e && e.platform ? String(e.platform).replace(/_/g, ' ').replace(/^./, (x) => x.toUpperCase()) : ''; };
  function roomSheet(id) {
    const h = hassNow(), r = roomsModel(h).find((x) => x.id === id);
    if (!r) return;
    const st = { open: null };
    const ov = M.overlay({ html: '', css: CSS + SHEET_CSS, maxWidth: 440 });
    const render = () => {
      const h2 = hassNow(), R = roomsModel(h2).find((x) => x.id === id) || r, rc = sget('rooms.' + id) || {}, O = rc.overrides || {}, picks = tp().picks || {}, pro = proOn();
      const slot = (role, label, ovKey) => {
        const C = candidates(h2, id, role), chosen = ovKey ? O[ovKey] : picks[id + ':' + role], auto = role === 'temp' ? R.tempId : role === 'hum' ? R.humId : C[0], cur = chosen || auto || null, mine = !!chosen;
        const open = st.open === role;
        return `<div class="sl"><div class="slh"><span class="tx"><span style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="mut" style="font-size:13px">${esc(label)}</span>${cur ? `<span class="bd${mine ? '' : ' auto'}">${esc(mine ? T('Valgt av deg', 'Chosen by you') : T('Valgt automatisk', 'Chosen automatically'))}</span>` : ''}</span>
          <b style="font-size:15px;font-weight:500" data-noi18n>${esc(cur ? M.name(h2, cur) : T('Fant ingen sensor', 'Found no sensor'))}</b><i style="font-style:normal;font-size:12px" class="mut">${esc(cur ? srcOf(h2, cur) : T('Trykk Velg for å velge en selv', 'Tap Choose to pick one yourself'))}</i>${pro && cur ? `<span class="mono" data-noi18n>${esc(cur)}</span>` : ''}</span>
          <span style="font-size:16px;font-weight:500;font-variant-numeric:tabular-nums" data-noi18n>${cur ? esc(valOf(h2, cur)) : ''}</span><button class="eb" data-a="slot" data-v="${role}">${esc(open ? T('Lukk', 'Close') : cur ? T('Bytt', 'Change') : T('Velg', 'Choose'))}</button></div>
          ${open ? `<div class="cands">${C.length ? C.map((cd, j) => `<button class="cd" data-a="pick" data-v="${role}" data-id="${esc(cd)}" data-k="${ovKey || ''}"><span style="display:flex;color:${cd === cur ? A_ : 'var(--ki-text-3, #7a7a7a)'}">${ic(cd === cur ? 'mdi:radiobox-marked' : 'mdi:radiobox-blank', 22)}</span><span class="tx"><b style="font-size:14px" data-noi18n>${esc(M.name(h2, cd))}</b><i style="font-size:12px">${esc(srcOf(h2, cd))}${j === 0 ? ' · ' + esc(T('anbefalt', 'recommended')) : ''}</i>${pro ? `<span class="mono" data-noi18n>${esc(cd)}</span>` : ''}</span><span style="font-size:14px" data-noi18n>${esc(valOf(h2, cd))}</span></button>`).join('') : ''}<div class="pk">${M.entityPicker.html({ key: 'pk-' + role, value: '', domains: role === 'temp' ? 'sensor,climate' : role === 'hum' ? 'sensor' : role === 'lys' ? 'light' : 'binary_sensor', area: id, placeholder: T('Velg fra Home Assistant', 'Choose from Home Assistant'), attrs: `data-role="${role}" data-k="${ovKey || ''}"` })}</div></div>` : ''}</div>`;
      };
      ov.body.innerHTML = `<div class="shh"><span data-noi18n>${esc(R.name)}</span><button class="done" data-a="done">${esc(T('Ferdig', 'Done'))}</button></div>
        <button class="tb" data-a="sroom" style="background:var(--ki-surface-2, #3a3a3a)"><span>${esc(T('Vis på Hjem', 'Show on Home'))}</span>${sw(R.fav)}</button>
        <div class="col"><span class="gl">${esc(T('Sensorer vi bruker', 'Sensors we use'))}</span><div class="slots">${slot('temp', T('Temperatur', 'Temperature'), 'temperature')}${slot('hum', T('Luftfukt', 'Humidity'), 'humidity')}${slot('lys', T('Lys', 'Lights'))}${slot('bev', T('Bevegelse', 'Motion'))}</div></div>`;
      ov.body.querySelectorAll('msh-entity-picker').forEach((p) => { p.hass = h2; });
    };
    const set = (ovKey, role, val) => TPS.commit(() => {
      if (ovKey) { const rc = sget('rooms.' + id) || {}; sset('rooms.' + id, clean({ ...rc, overrides: clean({ ...(rc.overrides || {}), [ovKey]: val || undefined }) })); }
      else sset('tilpass.picks', clean({ ...(tp().picks || {}), [id + ':' + role]: val || undefined }));
    }, `${r.name}: ${val ? M.name(hassNow(), val) : T('automatisk', 'automatic')}`);
    ov.root.addEventListener('value-changed', (e) => { const el = e.target; if (!el || !el.dataset || !el.dataset.role || !e.detail || !e.detail.value) return; st.open = null; set(el.dataset.k, el.dataset.role, e.detail.value); render(); });
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]'); if (!el) return;
      const a = el.dataset.a, v = el.dataset.v;
      if (a === 'done') { M.haptic('light'); ov.close(); return; }
      if (a === 'slot') { st.open = st.open === v ? null : v; M.haptic('selection'); render(); return; }
      if (a === 'pick') { st.open = null; set(el.dataset.k, v, el.dataset.id); render(); return; }
      if (a === 'sroom') { const R = roomsModel(hassNow()).find((x) => x.id === id); TPS.commit(() => setRoomFav(hassNow(), R, !R.fav), `${R.name} ${R.fav ? T('er fjernet fra Hjem-fanen', 'was removed from the Home tab') : T('vises på Hjem-fanen', 'is shown on the Home tab')}`); render(); }
    });
    const f = () => render(); live.add(f); ov.onClosed = () => live.delete(f);
    render();
  }
  const SHEET_CSS = `
    .body{gap:16px!important;padding:4px 0 30px}
    .shh{display:flex;align-items:center;gap:10px;padding:0 4px}.shh span{flex:1;min-width:0;font-size:22px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .done{height:40px;padding:0 18px;border-radius:20px;background:${GRAD_};color:var(--ki-on-accent, #2f2f2f);font-size:14px;font-weight:600;border:0;font-family:inherit;cursor:pointer}
    .slots{display:flex;flex-direction:column;background:var(--ki-surface, #323232);border-radius:24px;overflow:hidden}
    .sl{display:flex;flex-direction:column;gap:8px;padding:12px 12px 12px 16px}.sl+.sl{border-top:1px solid ${M.theme ? M.theme.whiteA(0.06) : 'rgb(255 255 255/.06)'}}
    .slh{display:flex;align-items:center;gap:10px}
    .bd{font-size:11px;font-weight:500;padding:3px 8px;border-radius:10px;background:${M.theme ? M.theme.whiteA(0.1) : 'rgb(255 255 255/.1)'};color:var(--ki-text-1, #d0d0d0)}.bd.auto{background:${SOFT_};color:${A_}}
    .eb{background:var(--ki-surface-2, #454545)}
    .cands{display:flex;flex-direction:column;gap:4px;padding-top:6px}
    .cd{display:flex;align-items:center;gap:12px;min-height:56px;padding:6px 12px;border-radius:18px;background:var(--ki-surface-2, #3a3a3a);text-align:left;color:inherit;border:0;font:inherit;cursor:pointer}
    .cprev{padding:16px;border-radius:26px;background:${BG_};box-shadow:0 0 0 1px ${M.theme ? M.theme.whiteA(0.1) : 'rgb(255 255 255/.1)'} inset;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .cpc{display:flex;flex-direction:column;align-items:flex-start;gap:14px;padding:16px;box-sizing:border-box;border-radius:var(--ki-radius, 26px);background:${CARD_}}
    .cpc.stor{grid-column:1 / -1;min-height:118px}.cpc.liten{min-height:104px}
    .rm{height:52px;border-radius:26px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:500;border:0;font-family:inherit;cursor:pointer}
    .rm.on{background:color-mix(in srgb, var(--ki-red-text, rgb(242 128 115)) 14%, transparent);color:var(--ki-red-text, #f4a196)}.rm.off{background:${SOFT_};color:${A_}}
    .adr{display:flex;align-items:center;gap:12px;min-height:64px;padding:0 8px 0 12px;border-radius:24px;background:var(--ki-surface-2, #3a3a3a)}
    .adr .gb{height:40px;padding:0 16px;border-radius:20px;background:${GRAD_};color:var(--ki-on-accent, #2f2f2f);font-size:14px;font-weight:600;border:0;font-family:inherit;cursor:pointer}
  `;
  const CARD_SRC = { strom: () => { const pp = M.powerPriceCfg ? M.powerPriceCfg() : {}; return pp.spot_entity || (M.powerPriceAuto && hassNow() && M.powerPriceAuto(hassNow(), pp)) || ''; }, soppel: () => { const c = cardCfg('msh-soppel-card', (CID().soppel || 'ki-home-soppel')); return c.sensor || (M.hjemTrashAuto && hassNow() && M.hjemTrashAuto(hassNow())) || ''; } };
  function cardSheet(key) {
    const ov = M.overlay({ html: '', css: CSS + SHEET_CSS, maxWidth: 440 });
    const render = () => {
      const x = homeBlocks().find((b) => b.id === key); if (!x) return ov.close();
      const src = CARD_SRC[key] ? CARD_SRC[key]() : '', h = hassNow();
      ov.body.innerHTML = `<div class="shh"><span>${esc(T('Tilpass', 'Customize'))} ${esc(x.label)}</span><button class="done" data-a="done">${esc(T('Ferdig', 'Done'))}</button></div>
        <div class="cprev"><div class="cpc ${x.size}"><span class="ri">${ic(x.icon, 20)}</span><span class="tx"><i style="font-size:13px">${esc(x.label)}</i></span></div></div>
        <div class="col"><span class="gl">${esc(T('Navn', 'Name'))}</span><input class="in" data-in="cname" value="${esc(x.label)}"></div>
        <div class="col"><span class="gl">${esc(T('Størrelse', 'Size'))}</span>${seg('csize', [['liten', 'Liten'], ['stor', 'Stor']], x.size)}</div>
        <div class="col"><span class="gl">${esc(T('Vises', 'Shown'))}</span>${seg('cwhen', [['alltid', 'Alltid'], ['hjemme', 'Noen hjemme'], ['kveld', 'Om kvelden']], x.when)}</div>
        ${src ? `<div class="col"><span class="gl">${esc(T('Henter data fra', 'Gets data from'))}</span><div class="slots"><div class="sl"><div class="slh"><span class="tx"><span class="bd auto" style="align-self:flex-start">${esc(T('Valgt automatisk', 'Chosen automatically'))}</span><b style="font-size:15px;font-weight:500" data-noi18n>${esc(M.name(h, src))}</b><i style="font-style:normal;font-size:12px" class="mut">${esc(srcOf(h, src))}</i>${proOn() ? `<span class="mono" data-noi18n>${esc(src)}</span>` : ''}</span><span data-noi18n>${esc(valOf(h, src))}</span></div></div></div></div>` : ''}
        <button class="rm ${x.on ? 'on' : 'off'}" data-a="con">${ic(x.on ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 20)}${esc(x.on ? T('Fjern fra Hjem', 'Remove from Home') : T('Vis på Hjem', 'Show on Home'))}</button>`;
    };
    const setX = (patch, msg, k) => TPS.commit(() => sset('tilpass.cards', { ...(tp().cards || {}), [key]: clean({ ...((tp().cards || {})[key] || {}), ...patch }) }), msg, k);
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]'); if (!el) return;
      const a = el.dataset.a, v = el.dataset.v, x = homeBlocks().find((b) => b.id === key);
      if (a === 'done') { M.haptic('light'); ov.close(); return; }
      if (a === 'csize') setX({ size: v === 'stor' ? undefined : v }, `${x.label}: ${v === 'stor' ? T('stor', 'large') : T('liten', 'small')}`);
      if (a === 'cwhen') setX({ when: v === 'alltid' ? undefined : v }, `${x.label}: ${T(WHEN[v], WHEN[v]).toLowerCase()}`);
      if (a === 'con') { const L = homeBlocks().map((b) => (b.id === key ? { ...b, on: !b.on } : b)); TPS.commit(() => homeWrite(L), `${x.label} ${x.on ? T('er fjernet', 'was removed') : T('vises igjen', 'is shown again')}`); }
      render();
    });
    ov.root.addEventListener('change', (e) => { const el = e.target; if (el.dataset && el.dataset.in === 'cname') setX({ label: el.value.trim() || undefined }, T('Navnet er lagret', 'The name was saved'), 'name:' + key); });
    const f = () => render(); live.add(f); ov.onClosed = () => live.delete(f);
    render();
  }
  function addSheet() {
    const ov = M.overlay({ html: '', css: CSS + SHEET_CSS, maxWidth: 440 });
    const render = () => {
      const L = homeBlocks().filter((b) => !b.on);
      ov.body.innerHTML = `<div class="shh"><span>${esc(T('Legg til kort', 'Add card'))}</span><button class="done" data-a="done">${esc(T('Ferdig', 'Done'))}</button></div>
        <span class="gl">${esc(T('Foreslått for huset ditt', 'Suggested for your house'))}</span>
        <div class="rows">${L.map((b) => `<div class="adr"><span class="ii" style="border-radius:20px">${ic(b.icon, 20)}</span><span class="tx"><b style="font-size:15px">${esc(b.label)}</b><i style="font-size:12px">${esc(T('Klar til bruk', 'Ready to use'))}</i></span><button class="gb" data-a="addit" data-v="${b.id}">${esc(T('Legg til', 'Add'))}</button></div>`).join('')}</div>
        ${L.length ? '' : `<span class="mut" style="font-size:15px;padding:16px 4px;text-align:center">${esc(T('Alle kortene er allerede på Hjem.', 'All the cards are already on Home.'))}</span>`}`;
    };
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a]'); if (!el) return;
      if (el.dataset.a === 'done') { M.haptic('light'); ov.close(); return; }
      if (el.dataset.a === 'addit') { const k = el.dataset.v, x = homeBlocks().find((b) => b.id === k); TPS.commit(() => homeWrite(homeBlocks().map((b) => (b.id === k ? { ...b, on: true } : b))), `${x.label} ${T('er lagt til', 'was added')}`); render(); }
    });
    render();
  }

  /* ------------------------------------------------------------ handlinger (felles for senteret, veiviseren og Rediger Hjem) */
  function act(st, a, v, el) {
    const h = hassNow();
    switch (a) {
      case 'theme': return TPS.commit(() => tpSet('theme', v === 'rosa' ? undefined : v), `${T('Farge', 'Colour')}: ${ACC[v][0]}`);
      case 'bg': return TPS.commit(() => tpSet('bg', v === 'grafitt' ? undefined : v), `${T('Bakgrunn', 'Background')}: ${BGS[v][0]}`);
      case 'density': return TPS.commit(() => tpSet('density', v === 'luftig' ? undefined : v), `${T('Tetthet', 'Density')}: ${v === 'kompakt' ? 'Kompakt' : 'Luftig'}`);
      case 'corner': return TPS.commit(() => tpSet('corner', v === 'rund' ? undefined : v), `${T('Hjørner', 'Corners')}: ${v === 'myk' ? 'Mindre runde' : 'Runde'}`);
      case 'lang':
        if (v === 'nn') { toast(T('Nynorsk kommer snart – bokmål brukes så lenge', 'Nynorsk is coming soon – Bokmål is used for now'), false); return; }
        return TPS.commit(() => { if (window.kiSetLang) window.kiSetLang(v === 'en' ? 'en' : 'no'); }, `${T('Språk', 'Language')}: ${v === 'en' ? 'English' : 'Bokmål'}`);
      case 'clean': { const on = tp().clean !== false; return TPS.commit(() => tpSet('clean', on ? false : undefined), on ? T('Viser originale navn', 'Showing the original names') : T('Navnene er ryddet', 'The names were tidied up')); }
      case 'strip': { const on = tp().strip !== false; return TPS.commit(() => tpSet('strip', on ? false : undefined), on ? T('Viser fulle navn', 'Showing full names') : T('Kortere navn i rom', 'Shorter names in rooms')); }
      case 'greet': return TPS.commit(() => hdrSet({ greeting: v === 'vink' ? undefined : v === 'tid' ? '{tid}, {name}' : (hdr().greeting && greetMode(hdr()) === 'fast' ? hdr().greeting : T('Velkommen hjem', 'Welcome home')) }), T('Hilsenen er endret', 'The greeting was changed'));
      case 'chip': {
        const cur = chipsOf(hdr()), on = cur.includes(v), next = on ? cur.filter((x) => x !== v) : [...(cur.length >= 2 ? cur.slice(1) : cur), v];
        const tpl = next.map((k) => CHIPS.find((x) => x[0] === k)[3]).join(' • ');
        return TPS.commit(() => hdrSet({ undertekst: tpl || undefined }), `${(CHIPS.find((x) => x[0] === v) || [])[2]} ${on ? T('er fjernet', 'was removed') : T('vises', 'is shown')}`);
      }
      case 'tabeye': { const c = fan(), hid = new Set(c.tab_hidden || []), TT = M.hjemAllTabs(h, c), t = TT.find((x) => x.id === v); if (!hid.has(v) && TT.filter((x) => !x.hidden).length <= 1) { toast(T('Minst én fane må vises', 'At least one tab must be shown'), false); return; } if (hid.has(v)) hid.delete(v); else hid.add(v); return TPS.commit(() => fanSet({ tab_hidden: [...hid] }), `${t ? t.label : v} ${hid.has(v) ? T('er skjult', 'is hidden') : T('vises igjen', 'is shown again')}`); }
      case 'cardeye': { const L = homeBlocks(), x = L.find((b) => b.id === v); return TPS.commit(() => homeWrite(L.map((b) => (b.id === v ? { ...b, on: !b.on } : b))), `${x.label} ${x.on ? T('er skjult', 'is hidden') : T('vises igjen', 'is shown again')}`); }
      case 'cardsheet': return cardSheet(v);
      case 'addcard': return addSheet();
      case 'dock': return TPS.commit(() => navSet({ dock: v === 'fast' ? 'fast' : undefined }), `Navbar: ${v === 'fast' ? T('fast i bunnen', 'docked at the bottom') : T('svevende', 'floating')}`);
      case 'navnames': { const on = !!nav().show_names; return TPS.commit(() => navSet({ show_names: on ? undefined : true }), on ? T('Navn er skjult', 'Names are hidden') : T('Navn vises', 'Names are shown')); }
      case 'naveye': { const L = navModel().list, x = L.find((n) => n.id === v); return TPS.commit(() => navWrite(L.map((n) => (n.id === v ? { ...n, on: !n.on } : n))), `${x.label} ${x.on ? T('er skjult', 'is hidden') : T('vises igjen', 'is shown again')}`); }
      case 'roomtog': { const r = roomsModel(h).find((x) => x.id === v); if (!r) return; return TPS.commit(() => setRoomOn(h, r, !r.on), `${r.name} ${r.on ? T('er skjult', 'is hidden') : T('vises igjen', 'is shown again')}`); }
      case 'roomfav': { const r = roomsModel(h).find((x) => x.id === v); if (!r) return; return TPS.commit(() => setRoomFav(h, r, !r.fav), `${r.name} ${r.fav ? T('er fjernet fra Hjem-fanen', 'was removed from the Home tab') : T('vises på Hjem-fanen', 'is shown on the Home tab')}`); }
      case 'roomsheet': return roomSheet(v);
      case 'persontog': { const P = personsModel(h), p = P.find((x) => x.id === v); return TPS.commit(() => profSet({ people_hidden: P.filter((x) => (x.id === v ? x.on : !x.on)).map((x) => x.id) }), `${p.name} ${p.on ? T('er skjult', 'is hidden') : T('vises igjen', 'is shown again')}`); }
      case 'pstyle': return TPS.commit(() => profSet({ show_name: v === 'navn' }), `${T('Personer', 'People')}: ${v === 'navn' ? T('Navn og bilde', 'Name and picture') : T('Bare bilde', 'Picture only')}`);
      case 'poptog': { const p = popupModel(h).find((x) => x.key === v); if (!p) return; return TPS.commit(() => { const cur = { ...(sget('popups.' + v) || {}) }; if (p.on) cur.hidden = true; else delete cur.hidden; sset('popups.' + v, Object.keys(cur).length ? cur : undefined); }, `${p.name} ${T('er', 'is')} ${p.on ? T('av', 'off') : T('på', 'on')}`); }
      case 'kmode': return TPS.commit(() => kioskSet(el.dataset.k, v, el.dataset.n), `${el.dataset.n}: ${T((KMODE.find((x) => x[0] === v) || [])[1], (KMODE.find((x) => x[0] === v) || [])[1])}`);
      case 'pro': proSet(!proOn()); toast(proOn() ? T('Installatørmodus er på', 'Installer mode is on') : T('Installatørmodus er av', 'Installer mode is off'), false); M.haptic('selection'); return rerender();
      case 'lock': { const on = !!tp().lock; return TPS.commit(() => tpSet('lock', on ? undefined : true), on ? T('Kunden kan endre alt', 'The customer can change everything') : T('Låst for kunden', 'Locked for the customer')); }
      case 'locked': toast(T('Installatøren har låst denne delen', 'The installer has locked this part'), false); M.haptic('warning'); return;
      case 'export': { const y = M.yaml && M.yaml.dump ? M.yaml.dump(snap()) : JSON.stringify(snap(), null, 2); try { navigator.clipboard.writeText(y); toast(T('Oppsettet er kopiert som YAML', 'The setup was copied as YAML'), false); } catch (e) { toast(T('Kunne ikke kopiere', 'Could not copy'), false); } return; }
      case 'import': return importSheet();
      case 'reset': return TPS.commit(() => { const keep = {}; const d = snap(); if (d.devices) keep.devices = d.devices; if (M.store) M.store.set('', keep); }, T('Alt er tilbakestilt', 'Everything was reset'));
      default: return undefined;
    }
  }
  function importSheet() {
    const ov = M.overlay({ html: `<div class="shh"><span>${esc(T('Importer oppsett', 'Import setup'))}</span><button class="done" data-a="imp">${esc(T('Importer', 'Import'))}</button></div><textarea class="in" style="height:240px;padding:14px 18px;border-radius:22px;font-family:ui-monospace,monospace;font-size:13px" placeholder="${esc(T('Lim inn et oppsett for å importere', 'Paste a setup to import'))}"></textarea>`, css: CSS + SHEET_CSS, maxWidth: 440 });
    ov.root.addEventListener('click', (e) => {
      const el = e.target.closest && e.target.closest('[data-a="imp"]'); if (!el) return;
      const t = ov.root.querySelector('textarea').value;
      let d = null; try { d = M.yaml && M.yaml.parse ? M.yaml.parse(t) : JSON.parse(t); } catch (x) { d = null; }
      if (!d || typeof d !== 'object') { toast(T('Fant ikke et gyldig oppsett', 'Not a valid setup'), false); return; }
      TPS.commit(() => M.store.set('', d), T('Oppsettet er importert', 'The setup was imported'));
      ov.close();
    });
  }

  function openDrop(list, tab, from, to) {
    const h = hassNow();
    if (list === 'tabs') { const c = fan(), TT = M.hjemAllTabs(h, c).map((t) => t.id); return TPS.commit(() => fanSet({ tab_order: moveArr(TT, from, to) }), T('Fanen er flyttet', 'The tab was moved')); }
    if (list === 'cards') { const L = homeBlocks(); return TPS.commit(() => homeWrite(moveArr(L, from, to)), `${L[from].label} ${T('er flyttet', 'was moved')}`); }
    if (list === 'nav') { const L = navModel().list; return TPS.commit(() => navWrite(moveArr(L, from, to)), `${L[from].label} ${T('er flyttet', 'was moved')}`); }
    if (list === 'rooms') { const R = roomsModel(h), by = roomOrder(h, R), L = by[tab] || [], t = L[0] && L[0].tab; if (!t) return; return TPS.commit(() => { const c = fan(); fanSet({ layout: setP(c.layout || {}, `${t.id}.order`, moveArr(L.map((r) => r.id), from, to)) }); }, `${L[from].name} ${T('er flyttet', 'was moved')}`); }
    if (list === 'persons') { const P = personsModel(h); return TPS.commit(() => profSet({ people_order: moveArr(P.map((p) => p.id), from, to) }), `${P[from].name} ${T('er flyttet', 'was moved')}`); }
    return undefined;
  }

  /* ------------------------------------------------------------ <ki-customize-center> (helskjerm-ark) */
  class Center extends HTMLElement {}
  if (!customElements.get('ki-customize-center')) customElements.define('ki-customize-center', Center);
  class Wizard extends HTMLElement {}
  if (!customElements.get('ki-setup-wizard')) customElements.define('ki-setup-wizard', Wizard);
  let openCenter = null;
  TPS.open = function (page) {
    if (openCenter && !openCenter.ov.host.isConnected) openCenter = null;
    if (openCenter) { openCenter.go(page && PAGES[page] ? page : null); return openCenter; }
    const st = { page: page && PAGES[page] ? page : null, q: '' };
    const ov = M.overlay({ html: '<ki-customize-center></ki-customize-center>', css: CSS, tilpass: true, tpTop: 0 });
    ov.host.setAttribute('data-tilpass', '');
    ov.host.setAttribute('data-tps', '');
    const el = ov.body.querySelector('ki-customize-center');
    const render = () => {
      const h = hassNow();
      if (st.page && locked(st.page)) st.page = null;
      const f = document.activeElement && ov.root.activeElement, keep = f && f.dataset && f.dataset.in === 'q' ? f.selectionStart : null;
      el.innerHTML = (PAGES[st.page || 'hub'] || PAGES.hub)(st, h);
      if (keep != null) { const q = el.querySelector('[data-in="q"]'); if (q) { q.focus(); try { q.setSelectionRange(keep, keep); } catch (e) { /* */ } } }
      if (M.tp && M.tp.fill) M.tp.fill(el);
    };
    const go = (p) => { st.page = p; const sh = ov.root.querySelector('.sh'); if (sh) sh.scrollTop = 0; render(); };
    el.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('[data-a]'); if (!b || !el.contains(b)) return;
      const a = b.dataset.a, v = b.dataset.v;
      if (a === 'close') { M.haptic('light'); return ov.close(); }
      if (a === 'back') { M.haptic('light'); return go(null); }
      if (a === 'open') { M.haptic('selection'); return go(v); }
      if (a === 'clearq') { st.q = ''; return render(); }
      if (a === 'sys') {
        M.haptic('light');
        if (v === 'pc') { const to = M.pc.mode() === 'pc' ? 'mobil' : 'pc'; M.pc.set(to); if (to === 'pc' && M.pc.wide && !M.pc.wide()) toast(T('PC-dashbordet vises når skjermen er minst 1100 px bred', 'The PC dashboard shows when the screen is at least 1100 px wide'), false); return render(); }
        ov.close();
        if (v === 'devices') { const nb = M.liveOf && M.liveOf('msh-navbar-card'); return nb && nb._devicesSheet(); }
        if (v === 'ha') return M.ha && M.ha.open();
        return undefined;
      }
      if (a === 'edithome') { M.haptic('light'); ov.close(); return TPS.editHome(); }
      if (a === 'wizard') { M.haptic('light'); ov.close(); return TPS.wizard({ step: 1 }); }
      act(st, a, v, b);
    });
    el.addEventListener('input', (e) => { const t = e.target; if (t.dataset.in === 'q') { st.q = t.value; render(); } if (t.dataset.in === 'var') { const k = t.dataset.k, val = parseFloat(t.value), V = TPS.vars(); const it = VARS.flatMap((g) => g[1]).find((x) => x[0] === k); TPS.commit(() => { const vars = { ...(tp().vars || {}), [k]: val }; if (k === 'billig' && val >= (vars.dyr ?? V.dyr)) vars.dyr = +(val + 0.1).toFixed(2); if (k === 'dyr' && val <= (vars.billig ?? V.billig)) vars.billig = +(val - 0.1).toFixed(2); tpSet('vars', vars); syncVar(k, val); }, `${it[1]} ${fV(val, it[5])}`, 'var:' + k); } });
    el.addEventListener('change', (e) => { const t = e.target; if (t.dataset.in === 'greettext') TPS.commit(() => hdrSet({ greeting: t.value.trim() || undefined }), T('Hilsenen er lagret', 'The greeting was saved'), 'greetText'); });
    dragList(el, '.rw', (from, to, list) => openDrop(list.dataset.list, list.dataset.tab, from, to));
    live.add(render);
    ov.onClosed = () => { live.delete(render); openCenter = null; };
    openCenter = { ov, go, render };
    ensureHelpers();
    render();
    return openCenter;
  };

  /* ------------------------------------------------------------ input_number.ki_* (Grenser og verdier) */
  const NUMS = VARS.flatMap(([, it]) => it);
  function syncVar(k, val) {
    const h = hassNow(), it = NUMS.find((x) => x[0] === k); if (!h || !it) return;
    if (h.states[it[7]]) h.callService('input_number', 'set_value', { entity_id: it[7], value: val }).catch(() => {});
  }
  let helpersAsked = false;
  function ensureHelpers() {
    const h = hassNow(); if (helpersAsked || !h || !isAdmin() || !h.callWS) return;
    helpersAsked = true;
    const V = TPS.vars();
    NUMS.forEach(([k, label, min, max, step, u, , id]) => {
      if (h.states[id]) return;
      h.callWS({ type: 'input_number/create', name: 'KI ' + label, min, max, step, initial: V[k], mode: 'slider', unit_of_measurement: u === 'kr' ? 'kr' : u === '°' ? '°C' : u, icon: 'mdi:tune-variant' }).catch(() => {});
    });
  }

  /* ------------------------------------------------------------ veiviseren <ki-setup-wizard> (Velkommen · Rom · Personer · Tema · Ferdig) */
  let openWiz = null;
  TPS.wizard = function (o) {
    o = o || {};
    if (openWiz && !openWiz.ov.host.isConnected) { openWiz = null; inWizard = false; }
    if (openWiz) { openWiz.go(o.step || 0); return openWiz; }
    const st = { step: Math.max(0, Math.min(4, Number(o.step) || 0)), first: !!o.first };
    const ov = M.overlay({ html: '<ki-setup-wizard></ki-setup-wizard>', css: CSS, tilpass: true, tpTop: 0, bgHaptic: false });
    ov.host.setAttribute('data-tilpass', ''); ov.host.setAttribute('data-tps', 'wizard');
    const el = ov.body.querySelector('ki-setup-wizard');
    inWizard = true;
    const finish = (to) => {
      if (M.store) { M.store.set('onboarded', true); tpSet('wizard_done', true); }
      inWizard = false; ov.close();
      if (to === 'hub') return TPS.open();
      setTimeout(() => toast(T('Hold inne et kort på Hjem for å endre det direkte.', 'Press and hold a card on Home to change it directly.'), false), 400);
      return undefined;
    };
    const render = () => {
      const h = hassNow(), k = st.step, R = roomsModel(h), P = personsModel(h), c = tp(), A = ACC[c.theme] || ACC.rosa, B = BGS[c.bg] || BGS.grafitt;
      const top = k > 0 && k < 4 ? `<div class="top"><div class="wz"><button class="rb" data-a="wback" title="${esc(T('Tilbake', 'Back'))}">${ic('mdi:arrow-left', 22)}</button><div class="wzm"><span>${esc(T('Steg', 'Step'))} ${k} ${esc(T('av', 'of'))} 3</span><div class="segs">${[1, 2, 3].map((n) => `<i class="${n <= k ? 'on' : ''}"></i>`).join('')}</div></div><button class="skip" data-a="wskip">${esc(T('Hopp over', 'Skip'))}</button></div></div>` : '<div style="height:max(12px, env(safe-area-inset-top, 0px))"></div>';
      const head = (t, sub) => `<div class="wh"><b>${esc(t)}</b><span>${esc(sub)}</span></div>`;
      let body = '';
      if (k === 0) {
        const fl = h ? M.floors(h).length : 0, NV = navModel().list.filter((x) => x.on).slice(0, 5), TT = h && M.hjemAllTabs ? M.hjemAllTabs(h, fan()).filter((t) => !t.hidden) : [], pops = popupModel(h).filter((x) => x.on).length;
        const makes = [['mdi:view-dashboard-outline', `${T('Fanene', 'The tabs')} ${TT.map((t) => t.label).join(', ')}`], ['mdi:door', T('Romkort og rom-popup for hvert rom', 'A room card and room popup for every room')], ['mdi:dock-bottom', `${T('Navbar med', 'Navbar with')} ${NV.map((n) => n.label).join(', ')}`], ['mdi:application-outline', `${pops} ${T('popups som passer huset', 'popups that suit the house')}`]];
        body = `<div class="big"><span class="bigi gi">${ic('mdi:home', 38)}</span><div class="bigt"><b>${esc(T('Velkommen hjem', 'Welcome home'))}</b><span>${esc(T('Vi har gått gjennom Home Assistant og funnet huset ditt. Sjekk at det stemmer, så er dashbordet klart på et par minutter.', 'We went through Home Assistant and found your house. Check that it is right and the dashboard is ready in a couple of minutes.'))}</span></div>
          <div class="fnd">${[[R.length, T('rom', 'rooms')], [P.length, T('personer', 'people')], [fl, T('etasjer', 'floors')]].map(([n, l]) => `<div><b>${n}</b><span>${esc(l)}</span></div>`).join('')}</div>
          <div class="mk"><span class="gl" style="padding:6px 0">${esc(T('Dette lager vi for deg', 'This is what we make for you'))}</span>${makes.map(([i, t]) => `<div>${ic(i, 20)}<span data-noi18n>${esc(t)}</span></div>`).join('')}</div></div>`;
      } else if (k === 1) body = head(T('Hvilke rom vil du se?', 'Which rooms do you want to see?'), `${T('Vi fant', 'We found')} ${R.length} ${T('rom fordelt på etasjene. Dra for å endre rekkefølgen, og trykk på stjernen for rom som skal vises på Hjem-fanen.', 'rooms across the floors. Drag to change the order, and tap the star for rooms that should be on the Home tab.')}`) + roomRows(h, true);
      else if (k === 2) body = head(T('Hvem bor her?', 'Who lives here?'), T('Vi bruker telefonene til å vise hvem som er hjemme. Slå av dem som ikke skal vises.', 'We use the phones to show who is home. Turn off those who should not be shown.')) + personRows(h);
      else if (k === 3) body = head(T('Velg et uttrykk', 'Choose a look'), T('Du ser endringen med en gang.', 'You see the change right away.')) + themePreview(h) + themeControls();
      else {
        const on = R.filter((r) => r.on), onP = P.filter((p) => p.on);
        const rows = [[T('Rom', 'Rooms'), `${on.length} ${T('av', 'of')} ${R.length} ${T('vises', 'shown')}`, 1], [T('Personer', 'People'), onP.map((p) => p.name).join(', ') || T('Ingen', 'None'), 2], [T('Tema', 'Theme'), `${A[0]} ${T('på', 'on')} ${B[0].toLowerCase()}`, 3]];
        body = `<div class="big"><span class="bigi gi" style="border-radius:36px">${ic('mdi:check', 40)}</span><div class="bigt"><b style="font-size:34px">${esc(T('Dashbordet er klart', 'The dashboard is ready'))}</b><span>${esc(T('Du finner alt igjen under Tilpass. Hold inne et kort på Hjem for å endre det direkte.', 'You will find everything again under Customize. Press and hold a card on Home to change it directly.'))}</span></div>
          <div class="card">${rows.map(([l, v, s2]) => `<div class="dn"><span class="tx"><i>${esc(l)}</i><b data-noi18n style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(v)}</b></span><button class="eb" data-a="wgo" data-v="${s2}">${esc(T('Endre', 'Change'))}</button></div>`).join('')}</div></div>`;
      }
      const cta = [T('Kom i gang', 'Get started'), T('Neste: personer', 'Next: people'), T('Neste: tema', 'Next: theme'), T('Fullfør', 'Finish'), T('Åpne dashbordet', 'Open the dashboard')][k];
      const alt = k === 0 ? T('Bruk standardoppsettet', 'Use the default setup') : k === 4 ? T('Gå til Tilpass', 'Go to Customize') : '';
      el.innerHTML = top + `<div class="col" style="gap:16px">${body}</div><div class="cta"><button data-a="wnext">${esc(cta)}</button>${alt ? `<button class="alt" data-a="walt">${esc(alt)}</button>` : ''}</div>`;
    };
    const go = (n) => { st.step = Math.max(0, Math.min(4, n)); const sh = ov.root.querySelector('.sh'); if (sh) sh.scrollTop = 0; M.haptic('selection'); render(); };
    el.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('[data-a]'); if (!b || !el.contains(b)) return;
      const a = b.dataset.a;
      if (a === 'wnext') return st.step < 4 ? go(st.step + 1) : finish();
      if (a === 'wback') return go(st.step - 1);
      if (a === 'wskip') return go(4);
      if (a === 'wgo') return go(Number(b.dataset.v));
      if (a === 'walt') return st.step === 0 ? go(4) : finish('hub');
      act(st, a, b.dataset.v, b);
    });
    dragList(el, '.rw', (from, to, list) => openDrop(list.dataset.list, list.dataset.tab, from, to));
    live.add(render);
    ov.onClosed = () => { live.delete(render); openWiz = null; inWizard = false; if (st.first && M.store) M.store.set('onboarded', true); };
    openWiz = { ov, go, render };
    render();
    return openWiz;
  };

  /* ------------------------------------------------------------ «Rediger Hjem» (langt trykk på et kort på Hjem) */
  let openEdit = null;
  TPS.editHome = function (focus) {
    if (openEdit && !openEdit.ov.host.isConnected) openEdit = null;
    if (openEdit) return openEdit;
    const ov = M.overlay({ html: '<div class="eh"></div>', css: CSS + SHEET_CSS + `.eh{display:flex;flex-direction:column;gap:12px}.eh .rw{min-height:64px;border-radius:24px}`, tilpass: true, maxWidth: 480 });
    ov.host.setAttribute('data-tilpass', ''); ov.host.setAttribute('data-tps', 'edit');
    const el = ov.body.querySelector('.eh');
    const render = () => {
      const hb = homeBlocks(), seen = !!tp().edit_hint_seen;
      el.innerHTML = `<div class="shh"><span>${esc(T('Rediger Hjem', 'Edit Home'))}</span><button class="done" data-a="edone">${esc(T('Ferdig', 'Done'))}</button></div>
        ${seen ? '' : `<div class="hint">${ic('mdi:gesture-tap-hold', 20)}<span>${esc(T('Dra for å flytte, trykk på øyet for å skjule.', 'Drag to move, tap the eye to hide.'))}</span><button class="ib" data-a="ehint" title="${esc(T('Lukk', 'Close'))}" style="width:36px;height:36px;color:inherit">${ic('mdi:close', 20)}</button></div>`}
        <div class="rows" data-list="cards">${hb.map((x) => row({ key: 'hb-' + x.id, id: x.id, drag: true, icon: x.icon, label: x.label, sub: `${x.size === 'stor' ? T('Stor', 'Large') : T('Liten', 'Small')} · ${T(WHEN[x.when], WHEN[x.when])}`, on: x.on, attrs: x.id === focus ? ' data-focus' : '', tail: `<button class="ib" data-a="cardeye" data-v="${x.id}" title="${esc(T('Vis eller skjul', 'Show or hide'))}">${ic(x.on ? 'mdi:eye-outline' : 'mdi:eye-off-outline', 22)}</button><button class="ib" data-a="cardsheet" data-v="${x.id}" title="${esc(T('Innstillinger', 'Settings'))}" style="margin-right:6px">${ic('mdi:tune', 22)}</button>` })).join('')}</div>
        <button class="add" data-a="addcard">${ic('mdi:plus', 20)}${esc(T('Legg til kort', 'Add card'))}</button>
        <button class="tb" data-a="ehub"><span>${esc(T('Mer i Tilpass', 'More in Customize'))}</span><span class="chev">${ic('mdi:chevron-right', 22)}</span></button>`;
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('[data-a]'); if (!b || !el.contains(b)) return;
      const a = b.dataset.a;
      if (a === 'edone') { M.haptic('success'); ov.close(); return toast(T('Hjem er lagret', 'Home was saved'), false); }
      if (a === 'ehint') { tpSet('edit_hint_seen', true); return render(); }
      if (a === 'ehub') { ov.close(); return TPS.open('kort'); }
      act({}, a, b.dataset.v, b);
    });
    dragList(el, '.rw', (from, to, list) => openDrop(list.dataset.list, list.dataset.tab, from, to));
    live.add(render);
    ov.onClosed = () => { live.delete(render); openEdit = null; };
    openEdit = { ov, render };
    render();
    return openEdit;
  };
  // Langt trykk (450 ms) på en blokk i msh-hjem-card → «Rediger Hjem». Romkortene i fanekortet har eget hold (more-info) og
  // er unntatt; trykk som starter på en knapp/lenke/glidebryter teller heller ikke. Bevegelse > 8 px avbryter.
  TPS.bindHold = function (root) {
    if (!root || root.__tpsHold) return;
    root.__tpsHold = true;
    let t = 0, slot = null, x0 = 0, y0 = 0, fired = false;
    const cancel = () => { clearTimeout(t); t = 0; if (slot) { slot.style.transform = ''; slot.style.transition = ''; } slot = null; };
    root.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      const path = e.composedPath ? e.composedPath() : [];
      const s = path.find((n) => n && n.dataset && n.dataset.slot);
      if (!s || s.dataset.slot === 'faner' || s.dataset.slot === 'ring') return;
      if (path.some((n) => n && n.localName && /^(input|textarea|select|ha-slider|msh-range)$/.test(n.localName))) return;
      cancel(); fired = false; slot = s; x0 = e.clientX; y0 = e.clientY;
      s.style.transition = 'transform .45s ease'; s.style.transform = 'scale(.96)';
      t = setTimeout(() => { const k = slot && slot.dataset.slot; fired = true; cancel(); if (navigator.vibrate) try { navigator.vibrate(10); } catch (x) { /* */ } M.haptic('medium'); TPS.editHome(k); }, 450);
    });
    root.addEventListener('pointermove', (e) => { if (t && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) cancel(); }, { passive: true });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => root.addEventListener(ev, () => { if (t) cancel(); }, { passive: true }));
    window.addEventListener('scroll', () => { if (t) cancel(); }, { passive: true });
    root.addEventListener('click', (e) => { if (fired) { fired = false; e.stopPropagation(); e.preventDefault(); } }, true);
    root.addEventListener('contextmenu', (e) => { if (slot || fired) e.preventDefault(); });
  };

  /* ------------------------------------------------------------ innganger (Fiks 26.2): alt går til senteret */
  // Gamle editorer for navbar, header og kiosk åpnes ikke lenger – ki-open-editor sendes videre til sidene i senteret.
  const ROUTE = { tilpass: null, 'tilpass-alt': null, navbar: 'navbar', header: 'header', kiosk: 'kiosk' };
  // 03-editors.js sender hver ki-open-editor til M.openDashEditor (også Innstillinger-radene) – omdirigeres her
  const dash0 = M.openDashEditor;
  M.openDashEditorV1 = dash0;
  M.openDashEditor = function (d) {
    d = d || {};
    if (d.editor === 'wizard' || d.editor === 'onboarding') return TPS.wizard({ step: d.step > 0 ? d.step : 0, first: d.editor === 'onboarding' });
    if (Object.prototype.hasOwnProperty.call(ROUTE, d.editor)) return TPS.open(ROUTE[d.editor] || d.page || null);
    return dash0 ? dash0.apply(this, arguments) : null;
  };
  M.kioskSheetV1 = M.kioskSheet;
  M.kioskSheet = () => TPS.open('kiosk');
  M.openTilpassAlt = () => TPS.open();
  M.openOnboarding = (o) => TPS.wizard({ step: o && o.step > 0 ? o.step : 0, first: true });
  M.openTilpass = (page) => TPS.open(page);

  M.tpsPages = PAGES; // tester / feilsøking
  M.tpsAct = act;
  M.tpsRoomsModel = roomsModel;
})();
