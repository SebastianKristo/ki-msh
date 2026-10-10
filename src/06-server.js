/* MSH.servervelger · felles servervelger («Bytt sted») – Fiks 37 (erstatter Fiks 31.7/34.2).
 * Logikken er portet 1:1 fra family-status-card (ki-cards: _servere, _serverNavn, _serverBytt, _serverPlass,
 * _serverGest/_greetingGest/_onGreetingClick, _renderServerMeny); designet (menyen) fra Hjem v3.
 * (MSH.server er Server-kortets hjelper i 58-server.js – derfor eget navn.)
 *
 * Config (kortets, f.eks. msh-hjem-header-card):
 *   servere: "Oslo, Strömstad=Strømstad, Toten"      # tekst: etter = er navnet serveren har i Companion-appen
 *   servere: [{ navn, server?, ikon?, farge?, sti? }]  # eller liste (strenger i listen → { navn, server })
 *   (ikke satt → standardstedene Oslo, Toten, Strømstad – V.STD; servere: [] / '' = ingen steder, ingen meny)
 *   server_sti: lovelace     # siden som åpnes på den andre serveren (ellers samme dashbord som nå)
 *   server_navn: Oslo        # overstyrer gjenkjenningen (hass.config.location_name)
 *   server_plass: tittel     # tittel | under | navn
 *   server_meny_med: tap     # tap | double_tap | hold | ingen
 *   greeting_tap_action / greeting_double_tap_action / greeting_hold_action   # HA-handlinger på hilsenen
 *
 * Eldre config (Fiks 31.7/34.2: servers [{ name, icon, color, path, navigation_path, url }], this_server/place_name,
 * title_actions) leses fortsatt (V.cfg) og skrives om til de nye nøklene én gang av kortet (V.migrer).
 */
(function () {
  const M = window.MSH;
  if (!M) return;
  const V = {};
  V.DOBBEL_MS = 320; // fristen for andre trykk i et dobbelttrykk
  V.HOLD_MS = 500;

  /* ------------------------------------------------------------ servere (_servere) */
  // Streng splittes på , og =; strenger i listen → { navn, server }; rader uten navn droppes.
  V.parse = function (liste) {
    if (liste == null) liste = [];
    if (typeof liste === 'string') {
      liste = liste.split(',').map((d) => d.trim()).filter(Boolean).map((d) => {
        const [navn, server] = d.split('=').map((x) => x.trim());
        return { navn, server: server || navn };
      });
    }
    return (Array.isArray(liste) ? liste : []).map((s) => {
      if (typeof s === 'string') return { navn: s.trim(), server: s.trim() };
      if (!s || typeof s !== 'object') return {};
      const o = { navn: s.navn || s.server, server: s.server || s.navn };
      ['ikon', 'farge', 'sti', 'url'].forEach((k) => { if (s[k] != null && s[k] !== '') o[k] = s[k]; }); // 61.1: url = adressen (valgfri)
      return o;
    }).filter((s) => s.navn);
  };

  /* ------------------------------------------------------------ migrering fra 31.7/34.2 (les begge) */
  const TRIM = (v) => String(v == null ? '' : v).trim().replace(/^\/+/, '');
  // De gamle standardstedene (21.4/31.7) hadde egne ikoner/farger – de byttes mot standardstilen (V.stil)
  const OLD_STD = { oslo: ['mdi:office-building', 'mdi:city'], toten: ['mdi:tractor', 'mdi:barn'], 'strømstad': ['mdi:sail-boat'] };
  const OLD_COL = { oslo: 'var(--green)', toten: 'var(--yellow)', 'strømstad': 'var(--blue)' };
  const gammelRad = (r) => {
    if (typeof r === 'string') return { navn: r };
    if (!r || typeof r !== 'object' || !String(r.name || '').trim()) return null;
    const navn = String(r.name).trim(), o = { navn };
    let sti = r.path != null ? TRIM(r.path) : '';
    if (!sti) {
      const deep = [r.navigation_path, r.url_path, r.url].map((x) => String(x || '').trim()).find((x) => /^homeassistant:\/\//i.test(x));
      const m = deep && /^homeassistant:\/\/navigate\/([^?#]*)/i.exec(deep);
      if (m && m[1] && m[1] !== 'lovelace') sti = TRIM(m[1]);
    }
    if (sti) o.sti = sti;
    const k = V.vask(navn).replace(/stromstad/, 'strømstad');
    if (r.icon && !(OLD_STD[k] || []).includes(r.icon)) o.ikon = r.icon;
    if (r.color && r.color !== OLD_COL[k]) o.farge = r.color;
    return o;
  };
  // title_actions (Fiks 9) → greeting_*_action
  const PRESET = {
    kiosk: () => ({ action: 'kiosk' }),
    config: () => ({ action: 'navigate', navigation_path: '/config' }),
    edit: () => ({ action: 'edit' }),
    header: () => ({ action: 'tilpass' }),
    vaer: (c) => ({ action: 'navigate', navigation_path: (c && c.weather_hash) || '#vaer' }),
    none: () => ({ action: 'none' }),
  };
  V.PRESET = PRESET;
  V.GESTER = ['tap', 'double_tap', 'hold'];
  const OLD_KEYS = ['servers', 'servers_init', 'this_server', 'place_name', 'title_actions'];
  V.OLD_KEYS = OLD_KEYS;
  // Nye nøkler avledet av de gamle – bare for nøkler som ikke er satt fra før. {} = ingenting å migrere.
  V.fraGammel = function (c) {
    c = c || {};
    const out = {};
    if (c.servere == null && Array.isArray(c.servers)) out.servere = c.servers.map(gammelRad).filter(Boolean);
    const ts = c.this_server && typeof c.this_server === 'object' ? c.this_server : {};
    const her = String(ts.name || c.place_name || '').trim();
    if (c.server_navn == null && her) out.server_navn = her;
    const ta = c.title_actions && typeof c.title_actions === 'object' ? c.title_actions : null;
    if (ta) {
      let meny = '';
      V.GESTER.forEach((g) => {
        const v = ta[g];
        if (v === 'server') { if (!meny) meny = g; return; }
        if (v && PRESET[v] && c['greeting_' + g + '_action'] == null) out['greeting_' + g + '_action'] = PRESET[v](c);
      });
      if (c.server_meny_med == null) out.server_meny_med = meny || 'ingen';
    }
    return out;
  };
  V.harGammel = (c) => !!c && OLD_KEYS.some((k) => c[k] !== undefined);
  // Effektiv config: kortets config + nye nøkler avledet av de gamle (gamle nøkler fjernes fra resultatet)
  V.cfg = function (c) {
    c = c || {};
    if (!V.harGammel(c)) return c;
    const out = { ...c, ...V.fraGammel(c) };
    OLD_KEYS.forEach((k) => delete out[k]);
    return out;
  };
  // Skriv de nye nøklene til ki-store én gang og fjern de gamle (kalles fra kortets afterRender).
  // set(path, value) = M.store.set med kortets nøkkel foran. → true når noe ble skrevet.
  V.migrer = function (raw, set) {
    if (!V.harGammel(raw) || typeof set !== 'function') return false;
    const ny = V.fraGammel(raw);
    try {
      Object.keys(ny).forEach((k) => set(k, ny[k]));
      OLD_KEYS.forEach((k) => { if (raw[k] !== undefined) set(k, undefined); });
    } catch (e) { return false; }
    return true;
  };

  // Fiks 40: standardsteder (som Fiks 31.7 / Hjem v3 SERVERS) når servere IKKE er satt (null/undefined).
  // Brukerens egen liste overstyrer helt; en eksplisitt tom liste (servere: [] eller '') = bevisst ingen steder →
  // ingen meny og ingen pil. Ikon/farge kommer fra standardstilen (V.stil): Oslo/Toten/Strømstad.
  V.STD = ['Oslo', 'Toten', 'Strømstad'];
  V.raw = (c) => { const v = V.cfg(c).servere; return v == null ? V.STD : v; };
  V.erStd = (c) => V.cfg(c).servere == null;
  V.list = (c) => V.parse(V.raw(c));

  /* ------------------------------------------------------------ hvor er jeg (_serverNavn) */
  V.vask = (t) => String(t == null ? '' : t).toLowerCase().replace(/ö/g, 'ø').replace(/ä/g, 'æ').trim();
  V.navn = function (c, hass) {
    c = V.cfg(c);
    if (c.server_navn) return String(c.server_navn);
    const her = String((hass && hass.config && hass.config.location_name) || '');
    const treff = V.list(c).find((s) => V.vask(s.navn) === V.vask(her) || V.vask(s.server) === V.vask(her));
    return treff ? treff.navn : her;
  };

  /* ------------------------------------------------------------ hvor navnet står (_serverPlass) */
  // tittel – stedsnavnet ER den store linja · under – hilsen som før, stedsnavnet på linja under · navn – ingen stedsnavn
  // std = kortets standard når server_plass ikke er satt (f.eks. fra oppsettet).
  V.plass = function (c, std) {
    const v = String(V.cfg(c).server_plass || std || 'tittel').toLowerCase();
    if (v.startsWith('u')) return 'under';
    if (v.startsWith('n')) return 'navn';
    return 'tittel';
  };
  // Er det den store linja som er knappen for menyen? (bare med servere)
  // Fiks 61.1: bytteknapp/pil/meny bare når det finnes mer enn én server (én = bare dette stedet)
  V.flere = (c) => V.list(c).length > 1;
  V.storLinjeErMeny = (c, std) => V.flere(c) && V.plass(c, std) !== 'under';
  // Hilsenteksten for den store linja (_greetingText): tittel → «{server}» med mindre hilsenen har {server}
  V.tittelMal = (c, std, hilsen) => (V.plass(c, std) === 'tittel' && !/\{server\}/.test(hilsen || '') ? '{server}' : (hilsen || ''));

  /* ------------------------------------------------------------ plassholdere */
  const VAER_NB = { 'clear-night': 'Klar himmel', sunny: 'Sol', partlycloudy: 'Delvis skyet', cloudy: 'Skyet', fog: 'Tåke', rainy: 'Regn', pouring: 'Kraftig regn', snowy: 'Snø', 'snowy-rainy': 'Sludd', hail: 'Hagl', lightning: 'Torden', 'lightning-rainy': 'Torden og regn', windy: 'Vind', 'windy-variant': 'Vind og skyer', exceptional: 'Ekstremvær' };
  V.vaer = function (hass, id) {
    const st = id && hass && hass.states && hass.states[id];
    const a = (st && st.attributes) || {};
    const temp = a.temperature !== undefined && a.temperature !== null && a.temperature !== '' && isFinite(Number(a.temperature)) ? `${Math.round(Number(a.temperature))} ${a.temperature_unit || '°C'}` : '';
    return { temp, vaer: st && !/^(unavailable|unknown)$/.test(st.state) ? (VAER_NB[st.state] || st.state) : '' };
  };
  // {server}, {name}/{first_name}/{user}, {temp}, {vaer}; ledende/etterfølgende skilletegn fjernes (som _underTekst)
  V.fyll = function (mal, o) {
    o = o || {};
    return String(mal == null ? '' : mal)
      .replace(/\{temp\}/g, o.temp || '')
      .replace(/\{vaer\}/g, o.vaer || '')
      .replace(/\{(name|user|first_name)\}/g, o.name || '')
      .replace(/\{server\}/g, o.server || '');
  };
  V.rydd = (t) => String(t || '').replace(/^\s*[•·|,-]\s*|\s*[•·|,-]\s*$/g, '').trim();

  /* ------------------------------------------------------------ bytte server (_serverBytt) */
  // sti = s.sti || server_sti || første segment av location.pathname || 'lovelace' (ledende / fjernes).
  // Navnet kodes KUN for & ? # % og mellomrom – ø/ö står ukodet (som i mushroom-kortet).
  V.url = function (s, c) {
    c = V.cfg(c);
    let naa = '';
    try { naa = String((window.location && window.location.pathname) || '').split('/').filter(Boolean)[0] || ''; } catch (e) { /* */ }
    const sti = String((s && s.sti) || c.server_sti || naa || 'lovelace').replace(/^\/+/, '');
    const navn = String((s && (s.server || s.navn)) || '').replace(/[&?#%\s]/g, (t) => encodeURIComponent(t));
    return `homeassistant://navigate/${sti}?server=${navn}`;
  };
  // Byttet MÅ gå gjennom window.open – appen fanger det opp som «bytt server». location.href ignoreres stille av appen.
  V.bytt = function (s, c) {
    M.haptic('selection');
    // 61.1: utenfor Companion-appen og med adresse → åpne adressen (samme sti)
    const app = /Home Assistant/i.test((navigator && navigator.userAgent) || '');
    if (!app && s && s.url) { const c2 = V.cfg(c), sti = String(s.sti || c2.server_sti || '').replace(/^\/+/, ''); const u = String(s.url).replace(/\/+$/, '') + (sti ? '/' + sti : ''); window.open(u, '_self'); return u; }
    const url = V.url(s, c);
    window.open(url);
    return url;
  };

  /* ------------------------------------------------------------ standardstil (_serverStil) */
  // Fiks 40: ikonene fra Hjem v3 (SERVERS: apartment / agriculture / sailing → mdi, som Fiks 31.7)
  const KJENT = [
    [/oslo/, 'mdi:office-building', 'var(--green, #66d19e)'],
    [/str[øo]mstad/, 'mdi:sail-boat', 'var(--blue, #73b9f2)'],
    [/toten/, 'mdi:tractor', 'var(--yellow, #f2d26f)'],
  ];
  const RESERVE = ['var(--active-big, #f285c9)', 'var(--purple, #ad99e6)', 'var(--teal, #40c8e0)'];
  V.stil = function (srv, i) {
    const n = String((srv && srv.navn) || '').toLowerCase().replace(/ö/g, 'ø');
    const kjent = KJENT.find(([m]) => m.test(n));
    return {
      ikon: (srv && srv.ikon) || (kjent ? kjent[1] : 'mdi:home-variant-outline'),
      farge: (srv && srv.farge) ? M.color(srv.farge, srv.farge) : (kjent ? kjent[2] : RESERVE[(i || 0) % RESERVE.length]),
    };
  };

  /* ------------------------------------------------------------ handlinger og gester */
  // server_meny_med normalisert (uten hensyn til om det finnes servere): 'tap' | 'double_tap' | 'hold' | ''
  V.menyMed = function (c) {
    const v = String(V.cfg(c).server_meny_med || 'tap').toLowerCase();
    if (v.startsWith('d')) return 'double_tap';
    if (v.startsWith('h') || v.startsWith('l')) return 'hold';
    if (v.startsWith('n') || v === 'ingen') return '';
    return 'tap';
  };
  // Gesten som åpner menyen fra den store linja (_serverGest): '' uten servere / med server_plass under
  V.gest = (c, std) => (V.storLinjeErMeny(c, std) ? V.menyMed(c) : '');
  // Handling for en gest (_greetingHandling): greeting_<gest>_action → eldre felt → kortets standard (std[gest])
  V.handling = function (c, gest, std) {
    c = V.cfg(c);
    const satt = c['greeting_' + gest + '_action'];
    if (satt && satt.action) return satt;
    if (gest === 'tap' && c.greeting_navigation_path) return { action: 'navigate', navigation_path: c.greeting_navigation_path };
    if (gest === 'hold' && c.greeting_hold_entity) return { action: 'toggle', entity: c.greeting_hold_entity };
    const d = std && std[gest];
    return d && d.action ? d : { action: 'none' };
  };
  // Kjør en HA-handling (_kjorHandling). extra: { kiosk(), edit(), tilpass() } for kortets egne handlinger.
  V.kjor = function (card, h, extra) {
    const a = h && h.action, hass = (card && (card.hass || card._hass)) || M.lastHass;
    const fire = (type, detail) => (card || window).dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
    if (!a || a === 'none') return;
    if (extra && typeof extra[a] === 'function') return extra[a](h);
    if (a === 'navigate') { const p = String(h.navigation_path || ''); return M.navigate(p[0] === '?' ? location.pathname + p : p); }
    if (a === 'url') { if (h.url_path) window.open(h.url_path); return; }
    if (a === 'toggle') { const id = h.entity || (h.target && h.target.entity_id); if (id && hass) M.toggle(hass, id); return; }
    if (a === 'more-info') { const id = h.entity || (h.target && h.target.entity_id); if (id) M.moreInfo(card, id); return; }
    if (a === 'perform-action' || a === 'call-service') {
      const [d, n] = String(h.perform_action || h.service || '').split('.');
      if (d && n && hass) hass.callService(d, n, h.data || h.service_data || {}, h.target);
      return;
    }
    fire('hass-action', { config: { tap_action: h }, action: 'tap' }); // assist o.l. – HA kjenner resten
  };

  /* Gestene på hilsenen/stedsnavnet (port av _onGreetingPointerDown/_onGreetingClick/_greetingGest/_erAndreTrykk).
   * o: { meny() → 'tap'|'double_tap'|'hold'|'', handling(gest), apen(), veksle(), lukk(uten), kjor(h, gest), tilpass() }
   * Vanlig trykk håndteres i click (ikke pointerup): pointerup → click; åpnet menyen seg i pointerup, ville klikket som
   * kom etterpå truffet laget som lukker ved trykk utenfor. */
  V.gester = function (o) {
    const g = { holdt: false, timer: null, dobbel: null, forste: 0 };
    const tom = (h) => !h || h.action === 'none';
    g.gest = (gest) => {
      if (o.meny() === gest) { M.haptic('light'); o.veksle(); return; }
      const h = o.handling(gest);
      if (tom(h) && gest === 'hold' && o.tilpass) { M.haptic('medium'); o.tilpass(); return; } // langt trykk uten handling → Tilpass
      if (tom(h)) return;
      M.haptic(gest === 'hold' ? 'medium' : 'light');
      o.kjor(h, gest);
    };
    g.down = (e) => {
      if (e && e.button) return;
      g.holdt = false;
      clearTimeout(g.timer);
      g.x = e ? e.clientX : 0; g.y = e ? e.clientY : 0;
      g.timer = setTimeout(() => { g.timer = null; g.holdt = true; g.gest('hold'); }, V.HOLD_MS);
    };
    g.up = () => { if (g.timer) { clearTimeout(g.timer); g.timer = null; } };
    g.cancel = g.up;
    g.move = (e) => { if (g.timer && e && (Math.abs(e.clientX - g.x) > 8 || Math.abs(e.clientY - g.y) > 8)) g.up(); };
    g.erAndreTrykk = () => !!g.forste && Date.now() - g.forste < V.DOBBEL_MS;
    // Andre trykk i et dobbelttrykk der det første åpnet menyen: menyen fjernes straks (uten utgangsanimasjon)
    g.fraMeny = () => { g.forste = 0; o.lukk(true); if (o.meny() === 'double_tap') return; g.gest('double_tap'); };
    g.click = (e) => {
      if (g.holdt) { g.holdt = false; return; } // langt trykk er allerede håndtert
      if (e) e.stopPropagation();
      const harDobbel = o.meny() === 'double_tap' || !tom(o.handling('double_tap'));
      if (!harDobbel) { g.gest('tap'); return; } // ingen dobbelttrykk-handling → trykket kjøres med en gang
      if (g.dobbel) { clearTimeout(g.dobbel); g.dobbel = null; g.gest('double_tap'); return; }
      if (g.erAndreTrykk()) { g.fraMeny(); return; }
      // Trykk åpner menyen: MED EN GANG. Andre trykk innen fristen lander på menyens bakgrunn (g.bakgrunn).
      if (o.meny() === 'tap') { const apner = !o.apen(); g.gest('tap'); g.forste = apner ? Date.now() : 0; return; }
      g.dobbel = setTimeout(() => { g.dobbel = null; g.gest('tap'); }, 280);
    };
    // Trykk på menyens usynlige bakgrunn
    g.bakgrunn = () => {
      if (g.dobbel) { clearTimeout(g.dobbel); g.dobbel = null; o.lukk(true); g.gest('double_tap'); return; }
      if (g.erAndreTrykk()) { g.fraMeny(); return; }
      o.lukk();
    };
    // Trykk på selve menyarket (ikke en rad)
    g.ark = () => { if (g.erAndreTrykk()) g.fraMeny(); };
    g.stopp = () => { clearTimeout(g.timer); clearTimeout(g.dobbel); g.timer = g.dobbel = null; g.forste = 0; };
    return g;
  };

  /* ------------------------------------------------------------ menyen (_renderServerMeny, design Hjem v3) */
  // Portales til ki-overlay-root (document.body) og legges over dashbord-containeren (ikke vinduet, aldri over HA-
  // sidebaren) – også når kortet ligger i en Bubble-popup (transform → fixed ville blitt relativt til popupen).
  const W = M.theme ? M.theme.whiteA : (a) => `rgb(255 255 255 / ${a})`;
  const K = M.theme ? M.theme.blackA : (a) => `rgb(0 0 0 / ${a})`;
  const AT = (c) => (M.theme ? M.theme.accentText(c) : c);
  const CSS = () => `:host{all:initial}
    .vern{position:absolute;inset:0;background:transparent;-webkit-tap-highlight-color:transparent}
    .meny{position:absolute;box-sizing:border-box;width:260px;max-width:calc(100% - 24px);padding:8px;border-radius:22px;display:grid;gap:4px;
      background:var(--ki-surface, var(--gray200, #3a3a3a));border:1px solid ${W(0.08)};
      box-shadow:0 18px 48px ${K(0.5)},0 2px 8px ${K(0.3)};font-family:${M.FONT};color:var(--ki-text, #fafafa);
      animation:kimeny 220ms cubic-bezier(.2,1.2,.3,1);transform-origin:var(--ki-spiss-x,28px) -8px}
    .meny.ut{animation:kiut 140ms ease-out forwards}
    .meny::before{content:"";position:absolute;top:-6px;left:var(--ki-spiss,22px);width:12px;height:12px;transform:rotate(45deg);background:inherit;
      border-left:1px solid ${W(0.08)};border-top:1px solid ${W(0.08)};border-radius:3px 0 0 0}
    .topp{padding:6px 10px 4px;font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--ki-text-2, var(--gray800, #afafaf))}
    .rad{display:flex;align-items:center;gap:12px;padding:8px 10px;border:0;border-radius:14px;background:none;color:inherit;font:inherit;font-size:16px;text-align:left;cursor:pointer;
      -webkit-tap-highlight-color:transparent;transition:background .15s ease,transform .14s cubic-bezier(.2,1.3,.3,1)}
    .rad:active{transform:scale(.96);background:${W(0.08)}}
    .rad.na{background:${W(0.06)}}
    .flis{width:36px;height:36px;border-radius:11px;flex:none;display:flex;align-items:center;justify-content:center;
      background:color-mix(in srgb, var(--rad-farge) calc(22% * var(--ki-tone-k, 1)), transparent);color:var(--rad-fg, var(--rad-farge))}
    .rad.na .flis{background:var(--rad-farge);color:var(--ki-on-accent, rgb(20 20 24 / .85))}
    .flis ha-icon{--mdc-icon-size:20px;display:flex}
    .navn{flex:1;min-width:0;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .her{font-size:11px;font-weight:600;padding:3px 8px;border-radius:999px;background:var(--rad-farge);color:var(--ki-on-accent, rgb(20 20 24 / .85));white-space:nowrap}
    .gaa{--mdc-icon-size:20px;opacity:.45;flex:none;display:flex}
    .skille{height:1px;margin:2px 10px;background:${W(0.08)}}
    .tilpass .flis{background:${W(0.1)};color:var(--ki-text, #fafafa)}
    .tilpass .navn{opacity:.85}
    .lag{display:contents}
    @keyframes kimeny{from{opacity:0;transform:scale(.94) translateY(-6px)}}
    @keyframes kiut{to{opacity:0;transform:scale(.96)}}
    @media (prefers-reduced-motion: reduce){.meny{animation:none}}${AND ? AND_CSS : ''}`;
  /* Fiks 54 A1 · Android (ki-android, M.perf.android – iOS/PC får nøyaktig samme CSS og DOM-oppførsel som før; .lag er
   * display:contents der). Opptaket viste: åpningen så ut som ett bilde (kurven .2,1.2,.3,1 er nesten ferdig etter første
   * ramme), ett blankt bilde ved slutten av inn-animasjonen (laget ble tatt ned og tegnet på nytt), og lukkingen fadet HELE
   * den halvgjennomsiktige menyen over teksten bak (dobbel tekst). Nå:
   *   · .meny = bakgrunnslaget: fast, helt dekkende var(--ki-surface-2, #3a3a3a), aldri backdrop-filter, aldri opasitet –
   *     bare transform scale(.96) → 1 (160 ms) ved åpning;
   *   · .lag = indre lag (innholdet): opasitet 0 → 1 (160 ms) ved åpning, 1 → 0 ved lukking;
   *   · begge lagene beholder will-change (ikke tatt ned/tegnet på nytt når overgangen er ferdig);
   *   · overganger (transition), ikke keyframes – verten fjernes fra DOM-en først på transitionend (opasitet på .lag),
   *     med tidsfrist som reserve. */
  const AND = !!(M.perf && M.perf.android);
  V.AND_MS = 160;
  const AND_CSS = `
    .meny{animation:none!important;background:var(--ki-surface-2, #3a3a3a)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;opacity:1!important;
      transform:scale(1);transition:transform ${V.AND_MS}ms cubic-bezier(.2,.8,.2,1);will-change:transform}
    .meny.ut{animation:none!important;transition:none}
    .meny.fra{transform:scale(.96);transition:none}
    .lag{display:grid;gap:4px;opacity:1;transition:opacity ${V.AND_MS}ms ease-out;will-change:opacity}
    .meny.fra .lag{opacity:0;transition:none}
    .meny.ut .lag{opacity:0}
    @media (prefers-reduced-motion: reduce){.meny,.lag{transition:none!important}}`;
  const esc = M.esc;
  // Fiks 52 · hakk ved åpning (Android): menyen bygges ÉN gang og gjenbrukes (samme host, shadow root og <ha-icon>-noder –
  // ikonene slår ikke opp på nytt og blinker ikke), stilen er et delt CSSStyleSheet (parses én gang), bare arket animeres
  // (én inn-animasjon per åpning, ingen forsinkede rader som så ut som en ny innlasting), og åpne/lukke skriver ingenting
  // (ingen config/ki-store/localStorage). Nøkkelen er radenes HTML + CSS-en (tema) – endres noe, bygges menyen på nytt.
  const ARK = new Map(); // css → CSSStyleSheet
  const ark = (css) => {
    if (ARK.has(css)) return ARK.get(css);
    let sh = null;
    try { sh = new CSSStyleSheet(); sh.replaceSync(css); } catch (e) { sh = null; }
    if (ARK.size > 4) ARK.clear();
    ARK.set(css, sh);
    return sh;
  };
  let BUF = null; // { key, host, sr, meny, eier (api som eier menyen nå) }
  const radHTML = (liste, her, tilpass) => liste.map((srv, i) => {
    const na = srv.navn === her, st = V.stil(srv, i);
    return `<button class="rad${na ? ' na' : ''}" role="menuitem" data-i="${i}" ${na ? 'aria-current="location"' : ''} style="--rad-farge:${esc(st.farge)};--rad-fg:${esc(AT(st.farge))}">
        <span class="flis">${M.icon(st.ikon, 20)}</span><span class="navn">${esc(srv.navn)}</span>${na ? '<span class="her">Du er her</span>' : `<span class="gaa">${M.icon('mdi:chevron-right', 20)}</span>`}</button>`;
  }).join('') + (tilpass ? `<div class="skille"></div><button class="rad tilpass" role="menuitem" data-t="1"><span class="flis">${M.icon('mdi:tune-variant', 20)}</span><span class="navn">Tilpass …</span></button>` : '');
  // Bygg (eller hent) menyen for o uten å vise den. Kalles også ved pointerdown på navnet (V.forbered) så første åpning
  // ikke må parse stil og lage DOM i samme frame som trykket.
  const bygg = (o) => {
    const css = `${M.BASE_CSS || ''}${CSS()}`, rader = radHTML(o.liste || [], o.her, !!o.tilpass), key = css + '\n' + rader;
    // ledig (ikke satt inn, forvarmet, eller utgangsanimasjonen pågår) → gjenbrukes; V.meny setter den inn på nytt
    if (BUF && BUF.key === key && (!BUF.host.isConnected || !BUF.eier || BUF.eier.closed)) return BUF;
    const host = document.createElement('div');
    host.className = 'msh-portal';
    Object.assign(host.style, { position: 'fixed', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'auto', zIndex: '44' });
    const sr = host.attachShadow({ mode: 'open' }), sh = ark(css);
    const body = `<div class="vern"></div><div class="meny" role="menu" aria-label="Bytt sted"><div class="lag"><div class="topp">Bytt sted</div>${rader}</div></div>`;
    if (sh) { sr.adoptedStyleSheets = [sh]; sr.innerHTML = body; } else sr.innerHTML = `<style>${css}</style>${body}`;
    const b = { key, host, sr, meny: sr.querySelector('.meny'), lag: sr.querySelector('.lag'), eier: null };
    // Bubble Card lukker popupen ved klikk utenfor (lytter på window) – menyen er ikke «utenfor»
    const stop = (e) => e.stopPropagation();
    ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchmove', 'wheel'].forEach((t) => host.addEventListener(t, stop, { passive: true }));
    // Lytterne kobles én gang og sender videre til den som eier menyen nå (b.eier)
    sr.querySelector('.vern').addEventListener('click', () => { const a = b.eier; if (a && !a.closed) a._bakgrunn(); });
    b.meny.addEventListener('click', (e) => { const a = b.eier; if (a && !a.closed) a._klikk(e); });
    BUF = b;
    return b;
  };
  V.forbered = (o) => { try { if (o && o.liste && o.liste.length) bygg(o); } catch (e) { /* */ } };
  // Forvarm når nettleseren er ledig (én gang per side): menyen settes inn usynlig i én frame, så stil, layout og
  // ikonoppslagene (<ha-icon> i HA) er gjort før første trykk. Fjernes straks; åpnes den i mellomtiden, beholdes den.
  let varmet = false;
  V.varm = (o) => {
    if (varmet || !o || !o.liste || !o.liste.length) return;
    varmet = true;
    const kjor = () => {
      try {
        const b = bygg(o);
        if (b.host.isConnected || b.eier) return;
        const h = b.host;
        h.className = 'msh-portal msh-servermeny-varm';
        Object.assign(h.style, { visibility: 'hidden', pointerEvents: 'none' });
        M.overlayRoot().appendChild(h);
        requestAnimationFrame(() => requestAnimationFrame(() => { if (!b.eier) h.remove(); }));
      } catch (e) { /* */ }
    };
    if (window.requestIdleCallback) window.requestIdleCallback(kjor, { timeout: 6000 }); else setTimeout(kjor, 2500);
  };
  // o: { anchor (element), liste, her (navn), tilpass: bool, onVelg(srv), onTilpass(), onBakgrunn(), onArk(), onLukk() }
  // → { host, root, lukk(uten) }
  V.meny = function (o) {
    const liste = o.liste || [];
    const b = bygg(o), { host, sr, meny } = b;
    if (b.eier && !b.eier.closed) b.eier.lukk(true); // (gammel eier som ble fjernet utenfra)
    clearTimeout(b.fjern);
    if (b.ferdig) { const f = b.ferdig; b.ferdig = null; b.lag.removeEventListener('transitionend', f); f.borte(); } // valgt sted byttes likevel
    if (host.isConnected) host.remove(); // forvarmet/utgang pågår → settes inn på nytt under
    meny.classList.remove('ut');
    if (AND) meny.classList.add('fra'); // Fiks 54: startposisjonen (scale .96, indre lag usynlig) før innsettingen
    host.className = 'msh-portal msh-servermeny';
    host.style.visibility = '';
    host.style.pointerEvents = 'auto';
    // Plassering: under ankeret (navnet), spissen peker på navnet; holdes innenfor dashbordflaten
    const plasser = () => {
      const D = M.dashRect();
      host.style.left = D.left + 'px'; host.style.width = D.width + 'px';
      const a = o.anchor && o.anchor.getBoundingClientRect ? o.anchor.getBoundingClientRect() : { left: D.left + 16, bottom: 80, width: 0 };
      const bw = Math.min(260, D.width - 24);
      const ax = a.left - D.left;
      const left = Math.max(12, Math.min(ax, D.width - bw - 12));
      meny.style.left = left + 'px';
      meny.style.top = Math.round(a.bottom + 8) + 'px';
      const sp = Math.max(14, Math.min(bw - 26, ax + 22 - left));
      meny.style.setProperty('--ki-spiss', sp + 'px');
      meny.style.setProperty('--ki-spiss-x', (sp + 6) + 'px');
    };
    plasser();
    const api = { host, root: sr, closed: false };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); api.lukk(); } };
    const onHash = () => api.lukk(true);
    // etter(): kjøres når menyen er HELT borte (Android: etter transitionend) – f.eks. bytte av sted (Fiks 54)
    api.lukk = (uten, etter) => {
      if (api.closed) return;
      api.closed = true;
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('resize', plasser);
      const borte = () => { if (etter) { const f = etter; etter = null; try { f(); } catch (e) { console.error('msh servervelger', e); } } };
      if (b.eier === api) {
        if (uten || (M.reducedMotion && M.reducedMotion()) || !host.isConnected) { host.remove(); borte(); }
        else if (AND) {
          // Fiks 54: bare det indre laget fades; bakgrunnslaget står helt dekkende til verten fjernes på transitionend
          host.style.pointerEvents = 'none';
          meny.classList.remove('fra');
          meny.classList.add('ut');
          const ferdig = (e) => {
            if (e && (e.target !== b.lag || e.propertyName !== 'opacity')) return;
            clearTimeout(b.fjern);
            b.lag.removeEventListener('transitionend', ferdig);
            if (b.ferdig === ferdig) b.ferdig = null;
            if (b.eier === api) host.remove();
            borte();
          };
          ferdig.borte = borte;
          b.ferdig = ferdig;
          b.lag.addEventListener('transitionend', ferdig);
          clearTimeout(b.fjern);
          b.fjern = setTimeout(() => ferdig(), V.AND_MS + 400); // reserve: transitionend kom ikke (skjult fane o.l.)
        } else {
          host.style.pointerEvents = 'none'; meny.classList.add('ut');
          clearTimeout(b.fjern);
          b.fjern = setTimeout(() => { if (b.eier === api) host.remove(); }, 150);
          borte();
        }
      } else borte();
      if (o.onLukk) o.onLukk(uten);
    };
    api._bakgrunn = () => { if (o.onBakgrunn) o.onBakgrunn(); else api.lukk(); };
    api._klikk = (e) => {
      const r = e.composedPath().find((n) => n && n.classList && n.classList.contains('rad'));
      if (!r) { if (o.onArk) o.onArk(); return; }
      if (r.dataset.t) { M.haptic('light'); api.lukk(); if (o.onTilpass) o.onTilpass(); return; }
      const srv = liste[Number(r.dataset.i)];
      if (!srv) return;
      if (srv.navn === o.her) { api.lukk(); return; } // raden du allerede er på → bare lukk
      // Fiks 54 · Android: stedet byttes først når menyen er helt lukket (ingen tegning/bytte midt i fadingen);
      // ki-sted-valgt sendes da, så kort som avhenger av stedet kan oppdatere seg selv (ingen full tegning av Hjem).
      const velg = () => {
        if (o.onVelg) o.onVelg(srv);
        try { window.dispatchEvent(new CustomEvent('ki-sted-valgt', { detail: { navn: srv.navn, server: srv.server } })); } catch (e) { /* */ }
      };
      if (AND) { api.lukk(false, velg); return; }
      api.lukk();
      velg();
    };
    b.eier = api;
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('resize', plasser);
    // Ny innsetting (også gjenbrukt host) starter inn-animasjonen på nytt – én gang per åpning
    M.overlayRoot().appendChild(host);
    if (AND) {
      // Fiks 54: startverdiene (.fra) gjelder → les stilen (ingen layout) → slipp: transform + opasitet glir 160 ms
      void getComputedStyle(b.lag).opacity;
      meny.classList.remove('fra');
    }
    return api;
  };

  M.servervelger = V;
})();
