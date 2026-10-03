/* MSH.servervelger · felles servervelger («Bytt sted») – Fiks 37 (erstatter Fiks 31.7/34.2).
 * Logikken er portet 1:1 fra family-status-card (ki-cards: _servere, _serverNavn, _serverBytt, _serverPlass,
 * _serverGest/_greetingGest/_onGreetingClick, _renderServerMeny); designet (menyen) fra Hjem v3.
 * (MSH.server er Server-kortets hjelper i 58-server.js – derfor eget navn.)
 *
 * Config (kortets, f.eks. msh-hjem-header-card):
 *   servere: "Oslo, Strömstad=Strømstad, Toten"      # tekst: etter = er navnet serveren har i Companion-appen
 *   servere: [{ navn, server?, ikon?, farge?, sti? }]  # eller liste (strenger i listen → { navn, server })
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
      ['ikon', 'farge', 'sti'].forEach((k) => { if (s[k] != null && s[k] !== '') o[k] = s[k]; });
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

  V.list = (c) => V.parse(V.cfg(c).servere);

  /* ------------------------------------------------------------ hvor er jeg (_serverNavn) */
  V.vask = (t) => String(t == null ? '' : t).toLowerCase().replace(/ö/g, 'ø').replace(/ä/g, 'æ').trim();
  V.navn = function (c, hass) {
    c = V.cfg(c);
    if (c.server_navn) return String(c.server_navn);
    const her = String((hass && hass.config && hass.config.location_name) || '');
    const treff = V.parse(c.servere).find((s) => V.vask(s.navn) === V.vask(her) || V.vask(s.server) === V.vask(her));
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
  V.storLinjeErMeny = (c, std) => V.list(c).length > 0 && V.plass(c, std) !== 'under';
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
    const url = V.url(s, c);
    window.open(url);
    return url;
  };

  /* ------------------------------------------------------------ standardstil (_serverStil) */
  const KJENT = [
    [/oslo/, 'mdi:home-city-outline', 'var(--green, #66d19e)'],
    [/str[øo]mstad/, 'mdi:lighthouse', 'var(--blue, #73b9f2)'],
    [/toten/, 'mdi:tractor-variant', 'var(--yellow, #f2d26f)'],
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
      animation:kimeny 260ms cubic-bezier(.2,1.25,.3,1);transform-origin:var(--ki-spiss-x,28px) -8px;transition:opacity .14s ease-out,transform .14s ease-out}
    .meny.ut{opacity:0;transform:scale(.96)}
    .meny::before{content:"";position:absolute;top:-6px;left:var(--ki-spiss,22px);width:12px;height:12px;transform:rotate(45deg);background:inherit;
      border-left:1px solid ${W(0.08)};border-top:1px solid ${W(0.08)};border-radius:3px 0 0 0}
    .topp{padding:6px 10px 4px;font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--ki-text-2, var(--gray800, #afafaf))}
    .rad{display:flex;align-items:center;gap:12px;padding:8px 10px;border:0;border-radius:14px;background:none;color:inherit;font:inherit;font-size:16px;text-align:left;cursor:pointer;
      -webkit-tap-highlight-color:transparent;transition:background .15s ease,transform .14s cubic-bezier(.2,1.3,.3,1);animation:kirad 320ms cubic-bezier(.2,1.2,.3,1) backwards;animation-delay:var(--forsink,0ms)}
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
    @keyframes kirad{from{opacity:0;transform:translateY(-6px)}}
    @keyframes kimeny{from{opacity:0;transform:scale(.92) translateY(-6px)}}
    @media (prefers-reduced-motion: reduce){.meny,.rad{animation:none}}`;
  const esc = M.esc;
  // o: { anchor (element), liste, her (navn), tilpass: bool, onVelg(srv), onTilpass(), onBakgrunn(), onArk(), onLukk() }
  // → { host, root, lukk(uten), oppdater(her) }
  V.meny = function (o) {
    const liste = o.liste || [];
    const host = document.createElement('div');
    host.className = 'msh-portal msh-servermeny';
    const R = M.dashRect();
    Object.assign(host.style, { position: 'fixed', left: R.left + 'px', top: '0', width: R.width + 'px', height: '100%', pointerEvents: 'auto', zIndex: '44' });
    const sr = host.attachShadow({ mode: 'open' });
    const rader = liste.map((srv, i) => {
      const na = srv.navn === o.her, st = V.stil(srv, i);
      return `<button class="rad${na ? ' na' : ''}" role="menuitem" data-i="${i}" ${na ? 'aria-current="location"' : ''} style="--rad-farge:${esc(st.farge)};--rad-fg:${esc(AT(st.farge))};--forsink:${i * 45}ms">
        <span class="flis">${M.icon(st.ikon, 20)}</span><span class="navn">${esc(srv.navn)}</span>${na ? '<span class="her">Du er her</span>' : `<span class="gaa">${M.icon('mdi:chevron-right', 20)}</span>`}</button>`;
    }).join('');
    const tp = o.tilpass ? `<div class="skille"></div><button class="rad tilpass" role="menuitem" data-t="1" style="--forsink:${liste.length * 45}ms"><span class="flis">${M.icon('mdi:tune-variant', 20)}</span><span class="navn">Tilpass …</span></button>` : '';
    sr.innerHTML = `<style>${M.BASE_CSS || ''}${CSS()}</style><div class="vern"></div><div class="meny" role="menu" aria-label="Bytt sted"><div class="topp">Bytt sted</div>${rader}${tp}</div>`;
    const meny = sr.querySelector('.meny');
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
    // Bubble Card lukker popupen ved klikk utenfor (lytter på window) – menyen er ikke «utenfor»
    const stop = (e) => e.stopPropagation();
    ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'touchmove', 'wheel'].forEach((t) => host.addEventListener(t, stop, { passive: true }));
    const api = { host, root: sr, closed: false };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); api.lukk(); } };
    const onHash = () => api.lukk(true);
    api.lukk = (uten) => {
      if (api.closed) return;
      api.closed = true;
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('resize', plasser);
      if (uten || (M.reducedMotion && M.reducedMotion())) host.remove();
      else { host.style.pointerEvents = 'none'; meny.classList.add('ut'); setTimeout(() => host.remove(), 150); }
      if (o.onLukk) o.onLukk(uten);
    };
    sr.querySelector('.vern').addEventListener('click', () => { if (o.onBakgrunn) o.onBakgrunn(); else api.lukk(); });
    meny.addEventListener('click', (e) => {
      const b = e.composedPath().find((n) => n && n.classList && n.classList.contains('rad'));
      if (!b) { if (o.onArk) o.onArk(); return; }
      if (b.dataset.t) { M.haptic('light'); api.lukk(); if (o.onTilpass) o.onTilpass(); return; }
      const srv = liste[Number(b.dataset.i)];
      if (!srv) return;
      if (srv.navn === o.her) { api.lukk(); return; } // raden du allerede er på → bare lukk
      api.lukk();
      if (o.onVelg) o.onVelg(srv);
    });
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('resize', plasser);
    M.overlayRoot().appendChild(host);
    return api;
  };

  M.servervelger = V;
})();
