/* «Tilpass alt» v2 (Fiks 61.2) · fasit: «design/Onboarding v2.dc.html» (erstatter «Tilpass alt» og første oppstart fra
 * 54-onboarding.js). Veiviser i 13 steg der alt tilpasses direkte – ingen videresending til egne Tilpass-ark. Hvert valg
 * skrives straks til SAMME config som kortene og de fulle arkene leser (ki-store, per HA-bruker), så endringene vises med en
 * gang i dashbordet bak.
 *   Prikkene øverst er klikkbare, «n av 13» åpner en liste over alle steg, siste steg viser alle steg med «Endre».
 *   1 Språk           kiSetLang (ki-store lang)
 *   2 Ny enhet        ki-device-preset: '' (Hele dashbordet) · stue · kiosk (+ kiosk.devices.<browser_mod-id>) · rom
 *   3 Servere         Hjem-headeren: servere [{ navn, ikon, url }], server_navn = første rad («Denne serveren»)
 *   4 Velkommen       Områder, Etasjer, Personer (bare i veiviseren)
 *   5 Header          header-kortet (mode, greeting, weather_tap, server_meny_med / greeting_<gest>_action) +
 *                     header_profiles (people_order, people_hidden, size, badge, show_name, show_place, ring_me)
 *   6 Tema            navbarens style (white | glass) · MSH.setGlassAnim
 *   7 Navbar          navbarens bar / more / hidden, width, show_names, shrink, menu_names, mini { on, hide_in_media, hide_in_popups }
 *   8 Faner           Hjem-fanekortet: tab_order, tab_hidden, tab_labels, tab_views, tab_height (minst én synlig fane)
 *   9 Rom             Hjem-fanekortet: layout.<fane>.order / hidden / side.<rom>, rooms.<rom>.size
 *  10 Hjem-kort       prosa-kortet: prose[] (tekst før, kilde, tekst etter) · fanekortet: tiles.hjem.<flis>.slot
 *  11 Popups          Vær-stil (MSH.setVaerStil) · Søppel-kortet (sensor, type_sensor) · power_price (profil, område, sensor)
 *  12 Kiosk-modus     ki-store kiosk { entity, rows, devices } (som kiosk-arket, 53-kiosk.js)
 *  13 Ferdig          Gå til Hjem (eller Stue-tablet)
 * Første oppstart (MSH.onboardMaybe) åpner samme veiviser; «Ferdig»/lukk setter onboarded.
 */
(function () {
  const M = window.MSH;
  if (!M || M.tilpassV2) return;
  const esc = M.esc;
  const PINK = 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)', PK = 'rgb(242 133 201)';
  const ic = (n, s, st) => M.icon(n, s || 22, st || '');
  const hassNow = () => M.lastHass || ((document.querySelector('home-assistant') || {}).hass) || null;
  const sget = (p) => (M.store ? M.store.get(p) : undefined);
  const put = (p, v) => (M.store ? M.store.set(p, v, { now: true }) : Promise.resolve({ ok: false }));
  const T = (n, e) => (window.kiT ? window.kiT(n, e) : n);
  const mv = (a, i, d) => { const j = i + d; if (j < 0 || j >= a.length) return a; const n = [...a]; [n[i], n[j]] = [n[j], n[i]]; return n; };
  const clean = (o) => { const r = { ...o }; Object.keys(r).forEach((k) => { if (r[k] === undefined) delete r[k]; }); return r; };

  const STEPS = [
    ['lang', 'mdi:translate', 'Språk', 'Velg språk for hele dashbordet.'],
    ['device', 'mdi:devices', 'Ny enhet', 'Hva skal denne skjermen brukes til? Velg et oppsett som passer.'],
    ['servers', 'mdi:dns', 'Servere', 'Velg hvilke Home Assistant-servere dashbordet skal kunne bytte mellom, og gi dem et navn. Med bare én server vises ingen bytteknapp.'],
    ['ha', 'mdi:home', 'Velkommen', 'Dashbordet konfigureres automatisk fra områder, etasjer og registre i Home Assistant. Velg hva som skal tas med.'],
    ['header', 'mdi:account', 'Header', 'Hilsen, personer og hva som skjer når du trykker på navnet.'],
    ['theme', 'mdi:palette', 'Tema', 'Utseende for navbar og popups.'],
    ['nav', 'mdi:tune', 'Navbar', 'Velg hvilke knapper som ligger i navbaren, i Mer-menyen eller er skjult, og rekkefølgen.'],
    ['tabs', 'mdi:tab', 'Faner', 'Navn, rekkefølge, visning og størrelse på fanene.'],
    ['rooms', 'mdi:door', 'Rom', 'Hvilke rom som vises på hver fane, rekkefølge, side og størrelse.'],
    ['home', 'mdi:view-dashboard', 'Hjem-kort', 'Setningen øverst og kortene på Hjem-fanen.'],
    ['popups', 'mdi:open-in-new', 'Popups', 'Innstillinger for Vær, Søppel og Strømpris.'],
    ['kiosk', 'mdi:fit-to-screen', 'Kiosk-modus', 'Hva som skjules i Home Assistant, og på hvilke enheter.'],
    ['done', 'mdi:check-circle', 'Ferdig', 'Alt er lagret. Trykk Endre for å gå tilbake til et steg.'],
  ];
  const SRV_ICONS = [['home', 'mdi:home'], ['apartment', 'mdi:office-building'], ['cabin', 'mdi:home-group'], ['sailing', 'mdi:sail-boat'], ['agriculture', 'mdi:tractor'], ['villa', 'mdi:home-modern'], ['business', 'mdi:domain']];
  const SRV_COLS = ['rgb(102 209 158)', 'rgb(242 210 111)', 'rgb(115 185 242)', 'rgb(242 133 201)', 'rgb(242 181 115)', 'rgb(190 160 242)'];
  const PRE = [['', 'Hele dashbordet', 'Mobil og PC · alle rom og popups', [[0, 0, 12, 2], [0, 3, 6, 6], [6, 3, 6, 6]]], ['stue', 'Stue-tablet', 'Vegg-tablet i stua · lys, varme, media og scener', [[0, 0, 1, 12], [2, 0, 10, 3], [2, 4, 10, 2], [2, 7, 3, 5], [5, 7, 4, 5], [9, 7, 3, 5]]], ['kiosk', 'Kiosk', 'Klokke, vær og kalender i stor skrift', [[0, 0, 12, 5], [0, 6, 6, 6], [6, 6, 6, 6]]], ['rom', 'Ett rom', 'Bare ett rom · velg rom etterpå', [[0, 0, 12, 4], [0, 5, 12, 7]]]];
  const ACT = [['server', 'Bytt sted'], ['kiosk', 'Kiosk av/på'], ['config', 'Innstillinger'], ['edit', 'Rediger'], ['header', 'Tilpass header'], ['vaer', 'Åpne Vær'], ['none', 'Ingen']];
  const GEST = [['tap', 'Trykk'], ['double_tap', 'Dobbelttrykk'], ['hold', 'Hold']];
  const PSRC = [['text', 'Fast tekst'], ['weather', 'Vær'], ['temp', 'Ute-temp'], ['price', 'Strømpris'], ['watt', 'Effekt'], ['lights', 'Lys på'], ['events', 'Hendelser'], ['home', 'Hjemme'], ['lock', 'Dørlås'], ['alarm', 'Alarm'], ['trash', 'Søppel'], ['todo', 'Gjøremål']];
  const TILES = [['lock', 'mdi:key', 'Dørlås'], ['garage', 'mdi:garage', 'Garasjeport'], ['alarm', 'mdi:shield', 'Alarm'], ['cam', 'mdi:video', 'Kamera'], ['ruter', 'mdi:tram', 'Ruter'], ['todo', 'mdi:hammer-wrench', 'Gjøremål']];
  const KIOSK_HIDE = [['kiosk', 'Alt'], ['hide_header', 'Header'], ['hide_sidebar', 'Sidebar'], ['hide_menubutton', 'Menyknapp'], ['hide_search', 'Søk'], ['hide_assistant', 'Assistent'], ['hide_notifications', 'Varsler'], ['hide_account', 'Konto'], ['hide_edit_dashboard', 'Rediger dashbord']];
  const KROWS = [['mobile', 'mdi:cellphone', 'Mobil', 'Skjermer under 1000 px', { on: true, hide: ['hide_header'], when: 'switch', width: 1000 }], ['non_admin', 'mdi:account-off', 'Ikke-admin', 'Brukere uten adminrettigheter', { on: true, hide: ['kiosk'], when: 'always' }], ['users', 'mdi:account-group', 'Utvalgte brukere', '', { on: false, hide: ['kiosk'], when: 'switch', users: [] }]];

  /* ------------------------------------------------------------ config-tilgang (samme nøkler som kortene) */
  const CID = () => M.CARD_IDS || {};
  const cardId = (tag, def) => { const l = M.liveOf && M.liveOf(tag); return (l && l.config && l.config.card_id) || def; };
  const cardCfg = (tag, def) => { const l = M.liveOf && M.liveOf(tag); return { ...((l && l.config) || {}), ...((M.store && M.store.card(cardId(tag, def))) || {}) }; };
  const cardSet = (tag, def, patch) => { const id = cardId(tag, def); return put('cards.' + id, clean({ ...((M.store && M.store.card(id)) || {}), ...patch })); };
  const HDR = ['msh-hjem-header-card', 'ki-home-header'], NAV = ['msh-navbar-card', 'ki-navbar'], FAN = ['msh-hjem-faner-card', 'ki-home-faner'], PROSA = ['msh-prosa-card', 'ki-home-prosa'], SOP = ['msh-hjem-soppel-card', 'ki-home-soppel'];
  const hdr = () => cardCfg(HDR[0], CID().header || HDR[1]);
  const hdrSet = (p) => cardSet(HDR[0], CID().header || HDR[1], p);
  const prof = () => (M.hjemHeaderProfile ? M.hjemHeaderProfile() : {});
  const profSet = (p) => (M.profileSet ? M.profileSet('header_profiles', p) : Promise.resolve());
  const nav = () => cardCfg(NAV[0], CID().navbar || NAV[1]);
  const navSet = (p) => cardSet(NAV[0], CID().navbar || NAV[1], p);
  const fan = () => cardCfg(FAN[0], CID().faner || FAN[1]);
  const fanSet = (p) => cardSet(FAN[0], CID().faner || FAN[1], p);
  const getP = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setP = (o, p, v) => { const ks = String(p).split('.'), out = { ...(o || {}) }; let cur = out; ks.forEach((k, i) => { if (i === ks.length - 1) { if (v === undefined) delete cur[k]; else cur[k] = v; } else { cur[k] = { ...(cur[k] || {}) }; cur = cur[k]; } }); return out; };

  /* ------------------------------------------------------------ CSS */
  const CSS = `
    .sh{top:0;bottom:0;height:100%;max-height:none;border-radius:0 !important;--ki-sh-pt:0px;--ki-sh-px:0px;--ki-sh-pb:0px;padding:0}
    .bg{pointer-events:none}
    .body{display:flex;flex-direction:column;min-height:100%;width:100%;max-width:100%;min-width:0;box-sizing:border-box}
    button{border:0;background:none;color:inherit;font:inherit;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}
    input,select{font:inherit}
    .tw{box-sizing:border-box;width:100%;max-width:min(560px, 100%);min-width:0;min-height:100%;margin:0 auto;padding:calc(20px + env(safe-area-inset-top, 0px)) 18px 0;display:flex;flex-direction:column;gap:18px;color:var(--ki-text, #fafafa);font-family:${M.FONT}}
    .tp{display:flex;align-items:center;gap:12px}
    .b44{width:44px;height:44px;border-radius:22px;background:var(--ki-surface-2, #383838);display:grid;place-items:center;flex:none}
    .ttl{flex:1;font-size:28px;font-weight:500}
    .jb{height:40px;padding:0 10px 0 14px;border-radius:20px;background:var(--ki-surface-2, #383838);display:flex;align-items:center;gap:4px;font-size:13px;color:var(--ki-text-1, #c7c7c7)}
    .dots{display:flex;gap:4px}
    .dots button{flex:1;height:6px;border-radius:3px;background:var(--ki-ctrl, #444)}
    .dots button.on{background:${PK}}
    .jl{display:flex;flex-direction:column;padding:6px;border-radius:28px;background:var(--ki-surface, #2f2f2f)}
    .jl button{display:flex;align-items:center;gap:12px;min-height:48px;padding:0 14px;border-radius:22px;font-size:15px;text-align:left}
    .jl button.on{background:var(--ki-surface-2, #404040)}
    .jl .n{font-size:12px;color:var(--ki-text-3, #7f7f7f)}
    .hd{display:flex;flex-direction:column;gap:6px}
    .hd b{font-size:24px;font-weight:500}
    .hd span{font-size:15px;color:var(--ki-text-2, #bdbdbd);line-height:1.5;text-wrap:pretty}
    .col{display:flex;flex-direction:column;gap:8px}
    .grp{display:flex;flex-direction:column;gap:10px}
    .gh{font-size:13px;font-weight:500;color:var(--ki-text-mid, #9a9a9a);padding:6px 6px 0}
    .seg{display:flex;flex-direction:column;gap:8px;padding:14px;border-radius:24px;background:var(--ki-surface-2, #383838)}
    .seg>b{font-size:14px;font-weight:500}
    .chips{display:flex;flex-wrap:wrap;gap:6px}
    .chip{height:36px;padding:0 14px;border-radius:18px;font-size:13px;font-weight:500;background:var(--ki-surface-3, #2a2a2a);color:var(--ki-text, #fafafa)}
    .chip.on{background:${PK};color:var(--ki-on-accent, #2a1720)}
    .note{font-size:12px;color:var(--ki-text-mid, #9a9a9a);line-height:1.4}
    .fld{display:flex;flex-direction:column;gap:6px;padding:12px 16px;border-radius:24px;background:var(--ki-surface-2, #383838)}
    .fld span{font-size:12px;color:var(--ki-text-mid, #9a9a9a)}
    .fld input{width:100%;box-sizing:border-box;height:32px;border:0;outline:none;background:none;color:var(--ki-text, #fafafa);padding:0;font-size:16px}
    .fld input.mono{font-family:ui-monospace,monospace;font-size:14px}
    .tk{height:30px;padding:0 12px;border-radius:15px;background:var(--ki-surface, #4a4a4a);font-size:12px}
    .tog{display:flex;align-items:center;gap:14px;min-height:72px;padding:0 18px 0 8px;border-radius:36px;background:var(--ki-surface-2, #383838);text-align:left;width:100%}
    .ti{width:56px;height:56px;border-radius:28px;flex:none;display:grid;place-items:center;background:var(--ki-surface, #4a4a4a)}
    .ti.on{background:${PK};color:var(--ki-on-accent, #2a1720)}
    .tt{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
    .tt b{font-size:16px;font-weight:500}.tt i{font-style:normal;font-size:13px;color:var(--ki-text-mid, #9a9a9a)}
    .sw{position:relative;width:48px;height:28px;border-radius:14px;flex:none;background:var(--ki-ctrl, #5a5a5a);transition:background .2s}
    .sw.on{background:${PK}}
    .sw i{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:11px;background:var(--ki-knob, #fafafa);transition:left .2s}
    .sw.on i{left:23px}
    .it{display:flex;flex-direction:column;gap:10px;padding:10px;border-radius:26px;background:var(--ki-surface-2, #383838)}
    .it.dim{opacity:.55}
    .ir{display:flex;align-items:center;gap:10px;min-width:0}
    .iw{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;background:${PK};color:var(--ki-on-accent, #2a1720)}
    .it.dim .iw{background:var(--ki-surface, #4a4a4a);color:var(--ki-text, #fafafa)}
    .il{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
    .il b{font-size:15px;font-weight:500}.il i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #9a9a9a)}
    .iin{flex:1;min-width:0;height:40px;border-radius:14px;border:0;outline:none;padding:0 12px;background:var(--ki-surface-3, #2a2a2a);color:var(--ki-text, #fafafa);font-size:15px}
    .ud{display:flex;flex:none;border-radius:18px;background:var(--ki-surface-3, #2a2a2a);padding:2px}
    .ud button{width:34px;height:34px;border-radius:17px;display:grid;place-items:center}
    .ud button[disabled]{opacity:.3}
    .eye{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:var(--ki-surface-3, #2a2a2a)}
    .chg{height:36px;padding:0 14px;border-radius:18px;flex:none;background:var(--ki-surface-3, #2a2a2a);font-size:13px}
    .lch{display:flex;align-items:center;gap:14px;min-height:72px;padding:0 18px 0 8px;border-radius:36px;background:var(--ki-surface-2, #383838);width:100%}
    .lch.on{box-shadow:inset 0 0 0 2px ${PK}}
    .lch .ti{font-size:16px;font-weight:600}
    .pre{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .pre button{display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:24px;background:var(--ki-surface-2, #383838);text-align:left}
    .pre button.on{box-shadow:inset 0 0 0 2px ${PK}}
    .pre .th{position:relative;height:84px;border-radius:14px;background:var(--ki-surface-3, #2a2a2a);margin-bottom:4px}
    .pre .th span{position:absolute;border-radius:5px;background:var(--ki-surface, #4a4a4a)}
    .pre button.on .th span{background:rgba(242,133,201,0.55)}
    .pre b{font-size:16px;font-weight:600}.pre i{font-style:normal;font-size:12px;color:var(--ki-text-mid, #9a9a9a);line-height:1.4}
    .pv{height:48px;border-radius:24px;background:var(--ki-surface-2, #383838);display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px}
    .sr{display:flex;align-items:center;gap:10px;padding:8px;border-radius:32px;background:var(--ki-surface-2, #383838)}
    .sr .si{width:56px;height:56px;border-radius:28px;flex:none;display:grid;place-items:center;color:var(--ki-on-accent, #232323)}
    .sr .sf{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
    .sr input{width:100%;box-sizing:border-box;border:0;outline:none;background:none;padding:0}
    .sr .sn{height:30px;color:var(--ki-text, #fafafa);font-size:16px;font-weight:500}
    .sr .su{height:22px;color:var(--ki-text-mid, #9a9a9a);font-size:13px}
    .sr .me{flex:none;font-size:12px;color:var(--ki-text-mid, #9a9a9a);padding-right:10px}
    .del{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:rgb(242 128 115 / 0.2);color:var(--ki-red-text, rgb(242 128 115))}
    .add{height:56px;border-radius:28px;box-shadow:inset 0 0 0 1.5px ${M.theme && M.theme.whiteA ? M.theme.whiteA(0.18) : 'rgba(255,255,255,0.18)'};display:flex;align-items:center;justify-content:center;gap:8px;font-size:15px;font-weight:500}
    .sc{height:36px;padding:0 14px 0 10px;border-radius:18px;background:var(--ki-surface-2, #383838);display:flex;align-items:center;gap:6px;font-size:14px}
    .pr{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:24px;background:var(--ki-surface-2, #383838)}
    .pr .ph{display:flex;align-items:center;gap:8px}
    .pr .ph span{flex:1;font-size:12px;color:var(--ki-text-mid, #9a9a9a)}
    .pr .pg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);gap:6px}
    .pr input,.pr select{min-width:0;height:40px;border-radius:14px;border:0;outline:none;padding:0 10px;background:var(--ki-surface-3, #2a2a2a);color:var(--ki-text, #fafafa);font-size:14px}
    .pr select{background:rgb(242 133 201 / 0.18);color:var(--ki-pink-text, ${PK})}
    .ft{position:sticky;bottom:0;margin:auto -18px 0;padding:14px 18px calc(16px + env(safe-area-inset-bottom, 0px));background:var(--ki-sheet-bg, #282828);display:flex;gap:10px;z-index:3}
    .bk{flex:1;height:56px;border-radius:28px;background:var(--ki-surface-2, #383838);font-size:16px}
    .bk[disabled]{opacity:.4}
    .nx{flex:2;height:56px;border-radius:28px;background:${PINK};color:var(--ki-on-accent, #2a1720);font-size:16px;font-weight:600}
    .press:active,.chip:active,.tog:active,.lch:active{transform:scale(.98)}
  `;

  /* ------------------------------------------------------------ steg */
  const tog = (a, k, icon, label, sub, on) => `<button class="tog" data-a="${a}" data-k="${esc(k)}" role="switch" aria-checked="${!!on}"><span class="ti${on ? ' on' : ''}">${ic(icon, 24)}</span><span class="tt"><b>${esc(label)}</b>${sub ? `<i>${esc(sub)}</i>` : ''}</span><span class="sw${on ? ' on' : ''}"><i></i></span></button>`;
  const seg = (label, a, opts, cur, note, extra) => `<div class="seg"><b>${esc(label)}</b><div class="chips">${opts.map(([v, l]) => `<button class="chip${String(cur) === String(v) ? ' on' : ''}" data-a="${a}" data-v="${esc(v)}"${extra || ''}>${esc(l)}</button>`).join('')}</div>${note ? `<span class="note">${esc(note)}</span>` : ''}</div>`;
  const chips = (a, opts, cur, attrs) => `<div class="chips">${opts.map(([v, l]) => `<button class="chip${(Array.isArray(cur) ? cur.includes(v) : String(cur) === String(v)) ? ' on' : ''}" data-a="${a}" data-v="${esc(v)}" ${attrs || ''}>${esc(l)}</button>`).join('')}</div>`;
  const fld = (label, inp, val, ph, mono, tokens) => `<label class="fld"><span>${esc(label)}</span><input data-in="${inp}" value="${esc(val == null ? '' : val)}" placeholder="${esc(ph || '')}"${mono ? ' class="mono" autocapitalize="off" spellcheck="false"' : ''}>${tokens ? `<div class="chips">${tokens}</div>` : ''}</label>`;
  const ud = (a, k, i, n) => `<div class="ud"><button data-a="${a}" data-k="${esc(k)}" data-d="-1" ${i > 0 ? '' : 'disabled'} aria-label="Flytt opp">${ic('mdi:chevron-up', 20)}</button><button data-a="${a}" data-k="${esc(k)}" data-d="1" ${i < n - 1 ? '' : 'disabled'} aria-label="Flytt ned">${ic('mdi:chevron-down', 20)}</button></div>`;
  const eye = (a, k, dim) => `<button class="eye" data-a="${a}" data-k="${esc(k)}" aria-label="Vis / skjul">${ic(dim ? 'mdi:eye-off' : 'mdi:eye', 20, dim ? 'color:var(--ki-text-3, #7f7f7f)' : '')}</button>`;
  const item = (o) => `<div class="it${o.dim ? ' dim' : ''}" data-key="${esc(o.key)}"><div class="ir"><span class="iw"${o.col ? ` style="background:${o.col};color:var(--ki-on-accent, #232323)"` : ''}>${ic(o.icon, 22)}</span>${o.input || `<span class="il"><b${o.noTr ? ' data-noi18n' : ''}>${esc(o.label)}</b>${o.sub ? `<i>${esc(o.sub)}</i>` : ''}</span>`}${o.ud || ''}${o.eye || ''}${o.go || ''}</div>${(o.rows || []).join('')}</div>`;
  const grp = (head, inner) => `<div class="grp">${head ? `<span class="gh">${esc(head)}</span>` : ''}${inner}</div>`;

  function body(st) {
    const h = hassNow(), k = STEPS[st.step][0];
    if (k === 'lang') {
      const cur = window.kiLang ? window.kiLang() : 'no';
      return `<div class="col" data-noi18n>${[['no', 'NO', 'Norsk', 'Norsk bokmål'], ['en', 'EN', 'English', 'Engelsk']].map(([v, code, l, sub]) => `<button class="lch${cur === v ? ' on' : ''}" data-a="lang" data-v="${v}"><span class="ti${cur === v ? ' on' : ''}">${code}</span><span class="tt"><b>${l}</b><i>${sub}</i></span>${cur === v ? ic('mdi:check-circle', 26, `color:${PK}`) : ''}</button>`).join('')}</div>`;
    }
    if (k === 'device') {
      const cur = M.devicePreset ? M.devicePreset() : '';
      return `<div class="pre">${PRE.map(([v, l, sub, blocks]) => `<button class="${cur === v ? 'on' : ''}" data-a="preset" data-v="${v}"><span class="th">${blocks.map(([x, y, w, hh]) => `<span style="left:calc(${(x / 12 * 100).toFixed(2)}% + 5px);top:calc(${(y / 12 * 100).toFixed(2)}% + 5px);width:calc(${(w / 12 * 100).toFixed(2)}% - 7px);height:calc(${(hh / 12 * 100).toFixed(2)}% - 7px)"></span>`).join('')}</span><b>${esc(l)}</b><i>${esc(sub)}</i></button>`).join('')}</div>
        ${cur === 'stue' ? `<button class="pv press" data-a="pview">${ic('mdi:open-in-new', 20)}Forhåndsvis Stue-tablet</button>` : ''}`;
    }
    if (k === 'servers') {
      const L = srvRows(st);
      const chipsH = [['Oslo', 'Oslo', 'apartment'], ['Hytta', 'Cabin', 'cabin'], ['Båten', 'Boat', 'sailing'], ['Hjem', 'Home', 'home']].filter(([n, en]) => !L.some((x) => x.name === n || x.name === en)).map(([n, en, i]) => `<button class="sc press" data-a="srvchip" data-v="${esc(T(n, en))}" data-i="${i}">${ic(SRV_ICONS.find((x) => x[0] === i)[1], 18)}${esc(T(n, en))}</button>`).join('');
      return `<div class="col">${L.map((x, i) => `<div class="sr" data-key="sr-${i}"><button class="si" data-a="srvicon" data-i="${i}" title="Trykk på ikonet for å bytte." style="background:${SRV_COLS[i % SRV_COLS.length]}">${ic((SRV_ICONS.find((y) => y[0] === x.icon) || SRV_ICONS[0])[1], 24)}</button>
          <div class="sf"><input class="sn" data-in="srvname" data-i="${i}" value="${esc(x.name)}" placeholder="Navn, f.eks. Oslo eller Hytta" data-noi18n><input class="su" data-in="srvurl" data-i="${i}" value="${esc(x.url || '')}" placeholder="Adresse (valgfritt)" autocapitalize="off" spellcheck="false"></div>
          ${i === 0 ? '<span class="me">Denne serveren</span>' : `<button class="del" data-a="srvdel" data-i="${i}" aria-label="Fjern">${ic('mdi:close', 20)}</button>`}</div>`).join('')}
        <button class="add press" data-a="srvadd">${ic('mdi:plus', 22)}Legg til server</button>
        ${chipsH ? `<span class="gh">Forslag</span><div class="chips">${chipsH}</div>` : ''}</div>`;
    }
    if (k === 'ha') {
      const A = h ? M.areas(h) : [], F = h ? M.floors(h) : [], P = h ? M.all(h, 'person') : [];
      return `<div class="col">${tog('ha', 'areas', 'mdi:home', 'Områder', `${A.length} rom funnet`, st.on.areas)}${tog('ha', 'floors', 'mdi:stairs', 'Etasjer', F.map((f) => f.name).join(', ') || '–', st.on.floors)}${tog('ha', 'people', 'mdi:account-group', 'Personer', P.map((p) => M.name(h, p)).join(', ') || '–', st.on.people)}</div>`;
    }
    if (k === 'header') {
      const c = hdr(), P = prof(), mode = P.mode || c.mode || 'hilsen', greet = c.greeting != null ? c.greeting : '👋 {name}!';
      const ppl = h ? M.all(h, 'person') : [], ord = Array.isArray(P.people_order) ? P.people_order : ppl, O = [...ord.filter((x) => ppl.includes(x)), ...ppl.filter((x) => !ord.includes(x))];
      const hid = new Set(Array.isArray(P.people_hidden) ? P.people_hidden : (Array.isArray(c.people) ? c.people.filter((r) => r && r.hidden).map((r) => r.person) : []));
      const v = (key, d) => (P[key] != null ? P[key] : c[key] != null ? c[key] : d);
      const acts = M.hjemTitleActions ? M.hjemTitleActions(c) : { tap: 'server', double_tap: 'config', hold: 'kiosk' };
      return grp('', seg('Stil', 'hmode', [['hilsen', 'Hilsen'], ['sted', 'Sted'], ['navn', 'Navn'], ['profil', 'Profil'], ['stor', 'Stor']], mode)
          + (mode === 'hilsen' ? fld('Hilsen', 'greet', greet, '👋 {name}!', false, `<button class="tk" data-a="gtok" data-v=" {name}">+ Fornavn</button><button class="tk" data-a="gtok" data-v=" {server}">+ Sted</button>`) : ''))
        + grp('Personer', O.map((id, i) => item({ key: 'hp-' + id, icon: 'mdi:account', label: M.name(h, id), noTr: 1, dim: hid.has(id), ud: ud('hpmv', id, i, O.length), eye: eye('hpeye', id, hid.has(id)) })).join('')
          + seg('Størrelse på bildene', 'hsize', [['S', 'Liten'], ['M', 'Middels'], ['L', 'Stor']], v('size', 'M')) + seg('Merke', 'hbadge', [['icon', 'Ikon'], ['dot', 'Prikk'], ['ring', 'Ring'], ['none', 'Ingen']], v('badge', 'icon'))
          + tog('hflag', 'show_name', 'mdi:badge-account', 'Vis navn', '', !!v('show_name', false)) + tog('hflag', 'show_place', 'mdi:map-marker', 'Vis sted', 'Hjemme, sonen eller Borte under bildet', !!v('show_place', false)) + tog('hflag', 'ring_me', 'mdi:radiobox-marked', 'Ring rundt meg', 'Markerer bildet ditt', !!v('ring_me', false))
          + tog('hwtap', 'weather_tap', 'mdi:weather-partly-cloudy', 'Trykk på været åpner Vær', '', c.weather_tap !== false))
        + grp('Trykk på navnet', GEST.map(([g, l]) => seg(l, 'hgest', ACT, acts[g] === 'egen' ? '' : acts[g], '', ` data-g="${g}"`)).join(''));
    }
    if (k === 'theme') {
      const c = nav(), glass = c.style === 'glass', anim = M.glassAnimOn ? M.glassAnimOn() : true;
      return grp('', seg('Navbar og popup-topp', 'nstyle', [['white', 'Standard'], ['glass', 'Liquid glass']], glass ? 'glass' : 'white', glass ? 'Glass-navbar og glass-topp i alle popups.' : 'Hvit navbar og bubble-card-topp i popups.')
        + (glass ? tog('ganim', 'anim', 'mdi:animation', 'Glass-animasjon', 'Bevegelse i glasset når du trykker', anim) : ''));
    }
    if (k === 'nav') {
      const N = navLists(), c = nav(), mini = { on: true, hide_in_media: true, ...(c.mini || {}) };
      const mk = (arr, where) => arr.map((id, i) => item({ key: 'nv-' + id, icon: N.cat(id)[0], label: N.cat(id)[1], dim: where === 'off', ud: where !== 'off' ? ud('nmv', where + ':' + id, i, arr.length) : '', rows: [chips('nplace', [['bar', 'Navbar'], ['more', 'Mer'], ['off', 'Skjult']], where, `data-k="${esc(id)}"`)] })).join('');
      return grp('I navbaren', mk(N.bar, 'bar')) + grp('I Mer-menyen', mk(N.more, 'more')) + grp('Skjult', mk(N.off, 'off'))
        + grp('Utseende', seg('Bredde', 'nwidth', [['kompakt', 'Kompakt'], ['std', 'Standard'], ['full', 'Full']], c.width || 'std')
          + tog('nflag', 'show_names', 'mdi:label', 'Vis navn under ikonene', '', !!c.show_names) + tog('nflag', 'shrink', 'mdi:arrow-collapse-vertical', 'Krymp ved scrolling', '', c.shrink !== false) + tog('nflag', 'menu_names', 'mdi:format-list-bulleted', 'Navn i Mer-menyen', '', c.menu_names !== false))
        + grp('Mini-spiller', tog('nmini', 'on', 'mdi:play-circle', 'Vis mini-spiller', 'Over navbaren når noe spiller', mini.on !== false) + tog('nmini', 'hide_in_media', 'mdi:music-off', 'Skjul i Media-popupen', '', mini.hide_in_media !== false) + tog('nmini', 'hide_in_popups', 'mdi:application-outline', 'Skjul når en popup er åpen', '', !!mini.hide_in_popups));
    }
    if (k === 'tabs') {
      const c = fan(), TT = h && M.hjemAllTabs ? M.hjemAllTabs(h, c) : [], vis = TT.filter((t) => !t.hidden).length;
      return grp('', TT.map((t, i) => item({ key: 'tb-' + t.id, icon: t.kind === 'hjem' ? 'mdi:home' : t.view === 'batterier' ? 'mdi:battery-alert' : 'mdi:tab', dim: t.hidden,
          input: `<input class="iin" data-in="tlabel" data-k="${esc(t.id)}" value="${esc(t.label)}" data-noi18n>`, ud: ud('tmv', t.id, i, TT.length), eye: t.hidden || vis > 1 ? eye('teye', t.id, t.hidden) : '',
          rows: [chips('tview', [['karusell', 'Karusell'], ['liste', 'Kortliste'], ['batterier', 'Batterier']], t.view || 'liste', `data-k="${esc(t.id)}"`)] })).join(''))
        + grp('', seg('Høyde på fanene', 'theight', [['lav', 'Lav'], ['std', 'Standard'], ['mid', 'Middels'], ['hoy', 'Høy'], ['ekstra', 'Ekstra']], c.tab_height || 'std'));
    }
    if (k === 'rooms') {
      const c = fan(), TT = h && M.hjemAllTabs ? M.hjemAllTabs(h, c).filter((t) => !(M.hjemIsAkt && M.hjemIsAkt(t)) && t.view !== 'batterier') : [];
      const t = TT.find((x) => x.id === st.roomTab) || TT[0];
      if (!t) return '<span class="note">Fant ingen faner med rom.</span>';
      const R = M.hjemBaseRooms(h, c, t), hid = new Set(getP(c, `layout.${t.id}.hidden`) || []);
      return grp('', seg('Fane', 'rtab', TT.map((x) => [x.id, x.label]), t.id))
        + grp('', R.map((a, i) => { const side = getP(c, `layout.${t.id}.side.${a.id}`) || (i % 2 ? 'R' : 'L'), size = getP(c, `rooms.${a.id}.size`) || 'M';
          return item({ key: 'rm-' + a.id, icon: a.icon || 'mdi:texture-box', label: a.name, noTr: 1, dim: hid.has(a.id), ud: ud('rmv', a.id, i, R.length), eye: eye('reye', a.id, hid.has(a.id)),
            rows: [`<div class="chips">${[['L', 'Venstre'], ['R', 'Høyre']].map(([v, l]) => `<button class="chip${side === v ? ' on' : ''}" data-a="rside" data-k="${esc(a.id)}" data-v="${v}">${l}</button>`).join('')}${[['S', 'Liten'], ['M', 'Middels'], ['L', 'Stor']].map(([v, l]) => `<button class="chip${size === v ? ' on' : ''}" data-a="rsize" data-k="${esc(a.id)}" data-v="${v}">${l}</button>`).join('')}</div>`] }); }).join(''));
    }
    if (k === 'home') {
      const PR = proseRows(), fc = fan();
      return grp('Setningen øverst', PR.map((p, i) => `<div class="pr" data-key="pr-${esc(p.id || i)}"><div class="ph"><span>Setning ${i + 1}</span>${ud('pmv', String(i), i, PR.length)}<button class="del" style="width:36px;height:36px" data-a="pdel" data-k="${i}" aria-label="Fjern">${ic('mdi:close', 18)}</button></div>
          <div class="pg"><input data-in="ppre" data-k="${i}" value="${esc(p.pre || '')}" placeholder="Før"><select data-in="psrc" data-k="${i}">${PSRC.concat(PSRC.some(([v]) => v === p.src) || !p.src ? [] : [[p.src, p.src]]).map(([v, l]) => `<option value="${esc(v)}"${v === (p.src || 'text') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select><input data-in="ppost" data-k="${i}" value="${esc(p.post || '')}" placeholder="Etter"></div></div>`).join('')
          + `<button class="add press" style="height:52px" data-a="padd">${ic('mdi:plus', 22)}Legg til setning</button>`)
        + grp('Kort på Hjem', TILES.map(([kd, icon, label]) => { const sl = M.hjemTileSlot ? M.hjemTileSlot(fc, 'hjem', kd) : 'off', on = sl !== 'off', [sd, ps] = on ? sl.split('-') : ['L', 'top'];
          return item({ key: 'hc-' + kd, icon, label, dim: !on, eye: eye('heye', kd, !on), rows: on ? [`<div class="chips">${[['L', 'Venstre'], ['R', 'Høyre']].map(([v, l]) => `<button class="chip${sd === v ? ' on' : ''}" data-a="hslot" data-k="${kd}" data-v="${v}-${ps}">${l}</button>`).join('')}${[['top', 'Over rommene'], ['bottom', 'Under rommene']].map(([v, l]) => `<button class="chip${ps === v ? ' on' : ''}" data-a="hslot" data-k="${kd}" data-v="${sd}-${v}">${l}</button>`).join('')}</div>`] : [] }); }).join(''));
    }
    if (k === 'popups') {
      const vs = M.vaerStil ? M.vaerStil() : 'scene', sc = cardCfg(SOP[0], CID().soppel || SOP[1]), pp = M.powerPriceCfg ? M.powerPriceCfg() : {}, se = pp.profile === 'se';
      return grp('Vær', seg('Stil', 'vstil', [['scene', 'Scene'], ['klassisk', 'Klassisk']], vs, vs === 'scene' ? 'Helbakgrunn med været. Skjuler navbar og mini-spiller mens den er åpen.' : 'Kort med time- og døgnvarsel i vanlig popup.'))
        + grp('Søppel', fld('Sensor for neste tømming', 'trash', sc.sensor || '', (M.hjemTrashAuto && h && M.hjemTrashAuto(h)) || 'sensor.neste_tomming', true) + fld('Sensor for type', 'trashtype', sc.type_sensor || '', 'sensor.tomming_type', true))
        + grp('Strømpris', seg('Land', 'pprof', [['no', 'Norge'], ['se', 'Sverige']], pp.profile || 'no') + seg('Prisområde', 'parea', (M.POWER_AREAS || { no: [], se: [] })[se ? 'se' : 'no'].map((a) => [a, a]), (se ? pp.se_area : pp.area) || '')
          + fld('Strømpris-entitet', 'pent', (se ? pp.se_entity : pp.spot_entity) || '', (M.powerPriceAuto && h && M.powerPriceAuto(h, pp)) || 'sensor.nordpool_kwh_no1', true) + fld('Nettleie-sensor', 'pgrid', pp.grid_entity || '', 'sensor.nettleie', true));
    }
    if (k === 'kiosk') {
      const K = sget('kiosk') || {}, rows = K.rows || {}, devs = K.devices || {};
      const row = (id, icon, label, sub, def, x, key) => { const r = { ...def, ...(x || {}) };
        return item({ key: 'k-' + key, icon, label, sub, dim: !r.on, noTr: key.startsWith('d:'), eye: eye('keye', key, !r.on), rows: r.on ? [chips('khide', KIOSK_HIDE, r.hide || ['kiosk'], `data-k="${esc(key)}"`), chips('kwhen', [['switch', 'Når bryteren er på'], ['always', 'Alltid']], r.when || 'switch', `data-k="${esc(key)}"`)] : [] }); };
      return grp('', fld('Bryter for kiosk-modus', 'kent', K.entity || '', 'input_boolean.kiosk_mode', true))
        + grp('Gjelder for', KROWS.map(([id, icon, label, sub, def]) => row(id, icon, label, id === 'users' ? ((rows.users || {}).users || []).join(', ') : sub, def, rows[id], 'r:' + id)).join('')
          + Object.keys(devs).map((id) => row(id, 'mdi:tablet', devs[id].name || id, id, { on: false, hide: ['kiosk'], when: 'always' }, devs[id], 'd:' + id)).join(''));
    }
    if (k === 'done') return grp('', STEPS.slice(0, -1).map(([, icon, title], i) => item({ key: 'dn-' + i, icon, label: title, go: `<button class="chg press" data-a="go" data-v="${i}">Endre</button>` })).join(''));
    return '';
  }

  /* ------------------------------------------------------------ data per steg */
  function srvRows(st) {
    if (st.srv) return st.srv;
    const SV = M.servervelger, c = hdr(), h = hassNow();
    const L = SV && !SV.erStd(c) ? SV.list(c) : [];
    const back = (ik) => (SRV_ICONS.find((x) => x[1] === ik) || [])[0] || 'home';
    st.srv = L.length ? L.map((x) => ({ name: x.navn, icon: back(x.ikon), url: x.url || '' })) : [{ name: (SV && SV.navn(c, h)) || 'Hjem', icon: 'home', url: '' }];
    return st.srv;
  }
  function srvSave(st) {
    const L = st.srv.filter((x) => String(x.name || '').trim());
    const rows = L.map((x) => clean({ navn: x.name.trim(), ikon: (SRV_ICONS.find((y) => y[0] === x.icon) || SRV_ICONS[0])[1], url: (x.url || '').trim() || undefined }));
    return hdrSet({ servere: rows, server_navn: rows[0] ? rows[0].navn : undefined });
  }
  function navLists() {
    const c = nav(), CAT = M.navCat ? M.navCat() : {}, N = M.navNorm ? M.navNorm(c) : { B: c.buttons || {}, bar: c.bar || [], more: c.more || [], hidden: new Set(c.hidden || []) }, B = N.B || {};
    const cat = (id) => { const b = B[id] || {}, d = CAT[id] || ['mdi:star', id]; return [b.icon || d[0], b.label || d[1]]; };
    const hidden = new Set(N.hidden);
    const bar = N.bar.filter((id) => !hidden.has(id)), more = N.more.filter((id) => !hidden.has(id) && !bar.includes(id));
    const off = [...N.bar, ...N.more].filter((id, i, a) => a.indexOf(id) === i && hidden.has(id));
    return { bar, more, off, cat, hidden };
  }
  function proseRows() {
    const c = cardCfg(PROSA[0], CID().prosa || PROSA[1]), h = hassNow();
    return Array.isArray(c.prose) ? c.prose : (M.prosaDefault && h ? M.prosaDefault(h, c) : []);
  }
  const proseSet = (rows) => cardSet(PROSA[0], CID().prosa || PROSA[1], { prose: rows });

  /* ------------------------------------------------------------ handlinger */
  function act(st, a, el, ov) {
    const d = el.dataset, h = hassNow(), v = d.v, k = d.k;
    M.haptic('selection');
    switch (a) {
      case 'go': st.step = Number(v); st.jump = false; return 'top';
      case 'dot': st.step = Number(v); st.jump = false; return 'top';
      case 'jump': st.jump = !st.jump; return;
      case 'back': if (st.step > 0) st.step--; st.jump = false; return 'top';
      case 'next':
        if (st.step >= STEPS.length - 1) { finish(st, ov); return 'closed'; }
        st.step++; st.jump = false; return 'top';
      case 'close': finish(st, ov, true); return 'closed';
      case 'lang': if (window.kiSetLang) window.kiSetLang(v); return;
      case 'preset': {
        if (M.setDevicePreset) M.setDevicePreset(v);
        if (v === 'kiosk') { const id = (() => { try { return localStorage.getItem('browser_mod-browser-id'); } catch (e) { return null; } })(); if (id) put('kiosk.devices.' + id, { ...(((sget('kiosk') || {}).devices || {})[id] || {}), on: true, hide: ['kiosk'], when: 'always', name: id }); }
        return;
      }
      case 'pview': if (M.devicePresetGo) { finish(st, ov); M.devicePresetGo(true); return 'closed'; } return;
      case 'srvicon': { const L = srvRows(st), i = Number(d.i), cur = SRV_ICONS.findIndex((x) => x[0] === L[i].icon); L[i] = { ...L[i], icon: SRV_ICONS[(cur + 1) % SRV_ICONS.length][0] }; srvSave(st); return; }
      case 'srvdel': { st.srv = srvRows(st).filter((_, j) => j !== Number(d.i)); srvSave(st); return; }
      case 'srvadd': { const L = srvRows(st); st.srv = [...L, { name: '', icon: SRV_ICONS[L.length % SRV_ICONS.length][0], url: '' }]; return; }
      case 'srvchip': { const L = srvRows(st), j = L.findIndex((x) => !String(x.name || '').trim()); if (j > -1) L[j] = { ...L[j], name: v, icon: d.i }; else st.srv = [...L, { name: v, icon: d.i, url: '' }]; srvSave(st); return; }
      case 'ha': st.on[k] = !st.on[k]; return;
      case 'hmode': return profSet({ mode: v });
      case 'gtok': { const c = hdr(); return hdrSet({ greeting: ((c.greeting != null ? c.greeting : '👋 {name}!') + v).trim() }); }
      case 'hpmv': case 'hpeye': {
        const P = prof(), ppl = h ? M.all(h, 'person') : [], ord = Array.isArray(P.people_order) ? P.people_order : ppl, O = [...ord.filter((x) => ppl.includes(x)), ...ppl.filter((x) => !ord.includes(x))];
        if (a === 'hpmv') { const i = O.indexOf(k); return profSet({ people_order: mv(O, i, Number(d.d)) }); }
        const c = hdr(), hid = new Set(Array.isArray(P.people_hidden) ? P.people_hidden : (Array.isArray(c.people) ? c.people.filter((r) => r && r.hidden).map((r) => r.person) : []));
        if (hid.has(k)) hid.delete(k); else hid.add(k);
        return profSet({ people_hidden: [...hid] });
      }
      case 'hsize': return profSet({ size: v });
      case 'hbadge': return profSet({ badge: v });
      case 'hflag': { const P = prof(), c = hdr(), cur = P[k] != null ? !!P[k] : !!c[k]; return profSet({ [k]: !cur }); }
      case 'hwtap': return hdrSet({ weather_tap: hdr().weather_tap === false ? undefined : false });
      case 'hgest': {
        const g = d.g, SV = M.servervelger, c = SV ? SV.cfg(hdr()) : hdr(), patch = {};
        if (v === 'server') { patch.server_meny_med = g; }
        else { if (SV && SV.menyMed(c) === g) patch.server_meny_med = 'ingen'; const P = SV && SV.PRESET[v]; patch['greeting_' + g + '_action'] = P ? P(c) : { action: 'none' }; }
        return hdrSet(patch);
      }
      case 'nstyle': return navSet({ style: v === 'glass' ? 'glass' : undefined });
      case 'ganim': if (M.setGlassAnim) M.setGlassAnim(!(M.glassAnimOn && M.glassAnimOn())); return;
      case 'nplace': {
        const N = navLists(), bar = N.bar.filter((x) => x !== k), more = N.more.filter((x) => x !== k), hid = new Set(N.hidden); hid.delete(k);
        if (v === 'bar') bar.push(k); else if (v === 'more') more.push(k); else hid.add(k);
        return navSet({ bar, more, hidden: [...hid] });
      }
      case 'nmv': { const [w, id] = k.split(':'), N = navLists(), arr = N[w], i = arr.indexOf(id); return navSet({ [w]: mv(arr, i, Number(d.d)) }); }
      case 'nwidth': return navSet({ width: v === 'std' ? undefined : v });
      case 'nflag': { const c = nav(), on = k === 'show_names' ? !!c.show_names : c[k] !== false; return navSet({ [k]: k === 'show_names' ? (on ? undefined : true) : (on ? false : undefined) }); }
      case 'nmini': { const c = nav(), m = { on: true, hide_in_media: true, ...(c.mini || {}) }; const cur = k === 'hide_in_popups' ? !!m[k] : m[k] !== false; return navSet({ mini: { ...(c.mini || {}), [k]: !cur } }); }
      case 'tmv': { const c = fan(), TT = M.hjemAllTabs(h, c).map((t) => t.id), i = TT.indexOf(k); return fanSet({ tab_order: mv(TT, i, Number(d.d)) }); }
      case 'teye': { const c = fan(), hid = new Set(c.tab_hidden || []), TT = M.hjemAllTabs(h, c); if (hid.has(k)) hid.delete(k); else if (TT.filter((t) => !t.hidden).length > 1) hid.add(k); return fanSet({ tab_hidden: [...hid] }); }
      case 'tview': { const c = fan(); return fanSet({ tab_views: { ...(c.tab_views || {}), [k]: v } }); }
      case 'theight': return fanSet({ tab_height: v === 'std' ? undefined : v });
      case 'rtab': st.roomTab = v; return;
      case 'rmv': case 'reye': case 'rside': case 'rsize': {
        const c = fan(), TT = M.hjemAllTabs(h, c).filter((t) => !(M.hjemIsAkt && M.hjemIsAkt(t)) && t.view !== 'batterier'), t = TT.find((x) => x.id === st.roomTab) || TT[0];
        if (!t) return;
        if (a === 'rsize') return fanSet({ rooms: setP(c.rooms, `${k}.size`, v) });
        let lay = c.layout || {};
        if (a === 'rmv') { const R = M.hjemBaseRooms(h, c, t).map((r) => r.id), i = R.indexOf(k); lay = setP(lay, `${t.id}.order`, mv(R, i, Number(d.d))); }
        if (a === 'reye') { const hid = new Set(getP(lay, `${t.id}.hidden`) || []); if (hid.has(k)) hid.delete(k); else hid.add(k); lay = setP(lay, `${t.id}.hidden`, [...hid]); }
        if (a === 'rside') lay = setP(lay, `${t.id}.side.${k}`, v);
        return fanSet({ layout: lay });
      }
      case 'pmv': { const R = proseRows(), i = Number(k); return proseSet(mv(R, i, Number(d.d))); }
      case 'pdel': { const R = proseRows(); return proseSet(R.filter((_, j) => j !== Number(k))); }
      case 'padd': return proseSet([...proseRows(), { id: 'p' + Date.now(), pre: '', src: 'text', fmt: '{v}', post: '', icon: '', color: 'hvit', cop: 'alltid' }]);
      case 'heye': { const c = fan(), sl = M.hjemTileSlot(c, 'hjem', k); return fanSet({ tiles: setP(c.tiles, `hjem.${k}.slot`, sl === 'off' ? 'L-top' : 'off') }); }
      case 'hslot': { const c = fan(); return fanSet({ tiles: setP(c.tiles, `hjem.${k}.slot`, v) }); }
      case 'vstil': if (M.setVaerStil) M.setVaerStil(v); return;
      case 'pprof': return priceSet({ profile: v === 'se' ? 'se' : undefined });
      case 'parea': { const pp = M.powerPriceCfg(); return priceSet({ [pp.profile === 'se' ? 'se_area' : 'area']: v }); }
      case 'keye': case 'khide': case 'kwhen': {
        const [kind, id] = k.split(':'), K = { ...(sget('kiosk') || {}) }, def = kind === 'r' ? (KROWS.find((x) => x[0] === id) || [])[4] || {} : { on: false, hide: ['kiosk'], when: 'always' };
        const path = kind === 'r' ? 'rows.' + id : 'devices.' + id, cur = { ...def, ...(getP(K, path) || {}) };
        if (a === 'keye') cur.on = !cur.on;
        if (a === 'kwhen') cur.when = v;
        if (a === 'khide') { const hd = cur.hide || []; cur.hide = v === 'kiosk' ? ['kiosk'] : hd.includes(v) ? hd.filter((x) => x !== v) : [...hd.filter((x) => x !== 'kiosk'), v]; if (!cur.hide.length) cur.hide = ['kiosk']; }
        return put('kiosk', setP(K, path, cur));
      }
      default: return;
    }
  }
  const priceSet = (patch) => { const pp = { ...((M.store && M.store.get('power_price')) || {}) }; Object.keys(patch).forEach((x) => { if (patch[x] === undefined || patch[x] === '') delete pp[x]; else pp[x] = patch[x]; }); return put('power_price', Object.keys(pp).length ? pp : undefined); };
  function input(st, el) {
    const k = el.dataset.k, v = el.value, i = Number(el.dataset.i);
    switch (el.dataset.in) {
      case 'srvname': { const L = srvRows(st); L[i] = { ...L[i], name: v }; return srvSave(st); }
      case 'srvurl': { const L = srvRows(st); L[i] = { ...L[i], url: v }; return srvSave(st); }
      case 'greet': return hdrSet({ greeting: v });
      case 'tlabel': { const c = fan(); return fanSet({ tab_labels: { ...(c.tab_labels || {}), [k]: v.trim() || undefined } }); }
      case 'ppre': case 'ppost': case 'psrc': { const R = proseRows().map((x) => ({ ...x })), j = Number(k), f = { ppre: 'pre', ppost: 'post', psrc: 'src' }[el.dataset.in]; R[j][f] = v; return proseSet(R); }
      case 'trash': return cardSet(SOP[0], CID().soppel || SOP[1], { sensor: v.trim() || undefined });
      case 'trashtype': return cardSet(SOP[0], CID().soppel || SOP[1], { type_sensor: v.trim() || undefined });
      case 'pent': { const pp = M.powerPriceCfg(); return priceSet({ [pp.profile === 'se' ? 'se_entity' : 'spot_entity']: v.trim() || undefined }); }
      case 'pgrid': return priceSet({ grid_entity: v.trim() || undefined });
      case 'kent': { const K = { ...(sget('kiosk') || {}) }; if (v.trim()) K.entity = v.trim(); else delete K.entity; return put('kiosk', K); }
      default: return undefined;
    }
  }
  function finish(st, ov, closeOnly) {
    if (st.first) put('onboarded', true);
    if (M.store && M.store.flush) M.store.flush();
    ov.close();
    if (!closeOnly && (M.devicePreset ? M.devicePreset() : '') === 'stue' && M.devicePresetGo) M.devicePresetGo(true);
  }

  /* ------------------------------------------------------------ arket */
  let open = null;
  function openV2(o) {
    o = o || {};
    if (open && open.isOpen) { open.st.step = Math.max(0, Math.min(STEPS.length - 1, o.step || 0)); open.draw(); return open.api; }
    const st = { step: Math.max(0, Math.min(STEPS.length - 1, Number(o.step) || 0)), jump: false, on: { areas: true, floors: true, people: true }, first: !!o.first, roomTab: null, srv: null };
    const ov = M.overlay({ html: '', css: CSS, sheet: false, maxWidth: 600, tall: true, footer: true, bgHaptic: false, onClose: () => { if (st.first) put('onboarded', true); open = null; } });
    const sc = () => ov.body.closest ? (ov.root.querySelector('.sh') || ov.body) : ov.body;
    const draw = () => {
      const [, , title, sub] = STEPS[st.step], last = st.step === STEPS.length - 1;
      const html = `<div class="tw" data-key="tw">
        <div class="tp"><button class="b44 press" data-a="close" aria-label="Lukk">${ic('mdi:arrow-left', 22)}</button><span class="ttl">Tilpass alt</span><button class="jb press" data-a="jump" aria-expanded="${st.jump}"><span>${st.step + 1} av ${STEPS.length}</span>${ic('mdi:format-list-bulleted', 20)}</button></div>
        <div class="dots">${STEPS.map((x, i) => `<button class="${i <= st.step ? 'on' : ''}" data-a="dot" data-v="${i}" title="${esc(x[2])}" aria-label="${esc(x[2])}"></button>`).join('')}</div>
        ${st.jump ? `<div class="jl">${STEPS.map(([, icon, t], i) => `<button class="${i === st.step ? 'on' : ''}" data-a="go" data-v="${i}">${ic(icon, 20, 'color:var(--ki-text-2, #afafaf)')}<span style="flex:1">${esc(t)}</span><span class="n">${i + 1}</span></button>`).join('')}</div>` : ''}
        <div class="hd"><b>${esc(title)}</b><span>${esc(sub)}</span></div>
        <div class="col" data-key="b-${st.step}" style="gap:18px">${body(st)}</div>
        <div style="flex:1"></div>
        <div class="ft"><button class="bk press" data-a="back" ${st.step ? '' : 'disabled'}>Tilbake</button><button class="nx press" data-a="next">${last ? ((M.devicePreset && M.devicePreset() === 'stue') ? 'Åpne Stue-tablet' : 'Gå til Hjem') : 'Neste'}</button></div>
      </div>`;
      M.morph(ov.body, html);
    };
    const redraw = (r) => { if (r === 'closed') return; draw(); if (r === 'top') { const s = sc(); if (s && s.scrollTo) s.scrollTo(0, 0); else if (s) s.scrollTop = 0; } };
    ov.root.addEventListener('click', (e) => {
      const el = e.composedPath().find((n) => n && n.dataset && n.dataset.a);
      if (!el || el.disabled) return;
      const r = act(st, el.dataset.a, el, ov);
      if (r && typeof r.then === 'function') r.then(() => redraw()); else redraw(r);
    });
    ov.root.addEventListener('change', (e) => {
      const el = e.composedPath().find((n) => n && n.dataset && n.dataset.in);
      if (!el) return;
      const r = input(st, el);
      if (el.tagName === 'SELECT') { M.haptic('selection'); if (r && r.then) r.then(() => redraw()); }
    });
    const onUpd = () => { if (open && open.isOpen) draw(); };
    window.addEventListener('ki-lang', onUpd);
    const api = { close: () => ov.close(), get step() { return st.step; } };
    open = { st, draw, api, isOpen: true };
    const c0 = ov.close; ov.close = () => { window.removeEventListener('ki-lang', onUpd); if (open) open.isOpen = false; return c0.call(ov); };
    draw();
    return api;
  }
  M.tilpassV2 = { open: openV2, STEPS };
  // «Tilpass alt» og første oppstart → veiviseren (den gamle oversikten / onboardingen står som …V1)
  if (M.openTilpassAlt) M.openTilpassAltV1 = M.openTilpassAlt;
  if (M.openOnboarding) M.openOnboardingV1 = M.openOnboarding;
  M.openTilpassAlt = (o) => openV2({ step: (o && o.step) || 0 });
  M.openOnboarding = (o) => openV2({ step: o && o.step > 0 ? 0 : 0, first: true });
})();
