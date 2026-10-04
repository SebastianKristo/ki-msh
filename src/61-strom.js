/* msh-strom-card · Strøm-popup v3 (#strom, Del 45) – ETT kort i Bubble-popupen (Mal A, «Strøm», mdi:power-plug).
 * Fasit: design/Strøm popup v3.dc.html (mål, farger → tokens med mørk fallback, tekster, animasjoner glowP/ping/draw/grow).
 * Innhold (designets rekkefølge): toppkort (energi-hus-v2.svg, BRUKER NÅ, spot-chip med ping, 3 glassfliser, glød) ·
 *   fanelinje Priser/Forbruk/Kurser (4 stiler, hold 400 ms + dra via MSH.tabRow, skjul, startfane via MSH.startTab,
 *   tannhjul i toppkortet eller ved fanelinjen) · Priser (regning/kostnad/spart, «Hva koster det nå», pris time for time
 *   med draw-animasjon, Norgespris-linje, Nå-markør, I dag/I morgen, scrub, nivå-chip, lavest/høyest/snitt (skjult som
 *   standard), «Inkludert i prisen» = input_boolean.include_* (bare de som finnes)) · Forbruk (2 valgbare kort, Dag/Måned/År
 *   med trend fra `endring`, datovelger + stablede timesøyler (grow-stagger), forklaring, kildetabell) · Kurser
 *   (M.stromKurser, 62-strom-kurser.js) · undersider Norgespris / Strømregning / Strøminnstillinger (M.stromSider,
 *   63-strom-sider.js) med tilbake-pil. Lenker til #norgespris / #stromregning / #strominnstillinger åpner undersidene.
 * Vertsgrensesnitt for modulene (B/C): host.hass, host.config, host.root, host.setCfg(patch), host.render(), host.go(page|null),
 *   host.ui (ren UI-tilstand, localStorage ki:<card_id>:ui), host.ent(role), host.anim, host.haptic(type), host.sec(tab).
 * Data: entiteter etter rolle (Auto/overstyrt i config.ent) + HAs Energi-oppsett (M.energiPrefs/M.energiSources, 52-energi.js)
 *   og recorder/statistics_during_period – hentes bare mens popupen er åpen, mellomlagres 5 min (fallgruve 8). Pris fra den
 *   felles strømpris-kilden (M.powerPrice, 15-strompris-kilde.js). Aldri mock: mangler → «–».
 * Config (A): order, hid, ent{effekt,spot,norge,dag,maned,spart,forbruk}, start, tabStyle (pille|kontur|ikoner|kompakt),
 *   gear (hero|tab), cardSize (stor|kompakt), useCards [2], exPrice (norge|spot|total), exShow [], ord{sec-*, useStats},
 *   anim, live, spot_chip (Fiks 47 M, standard på). Fiks 47: ent{trinn,margin,bil,tg_nettleie,tg_selskap,tg_stotte,tg_moms}
 *   (autokonfig via søkemønstre, aldri faste ID-er); toppkortets deler er more-info-trykkflater (T), «Inkludert i prisen»
 *   = hele pillen rosa + hold 500 ms → more-info (N), lange Visning-seksjoner som akkordeon (O, ren visning).
 *   B: kurs, ord.kurs, ord.cat. C: sider.*. «Tilpass strøm» (MSH.overlay tilpass) og getConfigElement
 *   (msh-strom-editor) viser de samme valgene og skriver de samme nøklene (config er sannheten, ki-store – fallgruve 3).
 */
(function () {
  const M = window.MSH;
  if (!M || customElements.get('msh-strom-card')) return;
  const esc = M.esc, TH = M.theme || {};
  const HASH = '#strom';
  const WA = (a) => (TH.whiteA ? TH.whiteA(a) : `rgba(255,255,255,${a})`); // ki-hex-ok: fallback uten tema / mørk fallback
  const KA = (a) => (TH.blackA ? TH.blackA(a) : `rgb(0 0 0 / ${a})`);
  const ic = (n, s, st) => M.icon(n, s || 24, st || '');
  const nf = (v, d) => M.nf(v, d || 0);
  const num = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  const PINK = 'linear-gradient(160deg,#f28ac9,#f6c9c4)';
  const ACC = 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';
  const TG_ON = 'linear-gradient(145deg, #f285c9 -10%, #f5cdc6 100%)'; // ki-hex-ok: aksentflate (Fiks 47 N)
  const INK = 'var(--ki-on-accent, rgba(50,38,44,.95))';
  const INK2 = 'var(--ki-on-accent, #2f2f2f)';
  const GREEN = 'var(--ki-green-text, rgb(120 210 165))', RED = 'var(--ki-red-text, rgb(240 120 100))';
  const GREEN_F = 'rgb(110 200 160)', AMBER_F = 'rgb(242 176 79)', RED_F = 'rgb(240 120 100)';
  const SURF = 'var(--ki-surface, #3d3d3d)', SURF2 = 'var(--ki-surface-2, #4f4f4f)';
  const T = 'var(--ki-text, #fafafa)', T1 = 'var(--ki-text-1, #e1e1e1)', T1B = 'var(--ki-text-1, #d6d6d6)', T2 = 'var(--ki-text-2, #b8b8b8)', T2B = 'var(--ki-text-2, #a8a8a8)', TM = 'var(--ki-text-mid, #979797)', T3 = 'var(--ki-text-3, #7f7f7f)';
  const PINK_T = 'var(--ki-pink-text, rgb(242 133 201))';
  const MND = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];
  const MNK = ['jan.', 'feb.', 'mars', 'apr.', 'mai', 'juni', 'juli', 'aug.', 'sep.', 'okt.', 'nov.', 'des.'];
  const DAGER = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
  const TTL = 300000, HOUR = 3600000;

  /* ------------------------------------------------------------ illustrasjon (energi-hus-v2.svg, også i examples/www/ki/) */
  const HUS_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250" fill="none"><defs><linearGradient id="wl" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stop-color="#2b2d35"></stop><stop offset="1" stop-color="#34373f"></stop></linearGradient><linearGradient id="wr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3d404b"></stop><stop offset="1" stop-color="#353843"></stop></linearGradient><linearGradient id="rf" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#434655"></stop><stop offset="1" stop-color="#30333d"></stop></linearGradient><linearGradient id="gw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4ebcc"></stop><stop offset="1" stop-color="#d8c79a"></stop></linearGradient><radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#f1e3b4" stop-opacity="0.28"></stop><stop offset="1" stop-color="#f1e3b4" stop-opacity="0"></stop></radialGradient><linearGradient id="gin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15161a"></stop><stop offset="1" stop-color="#26272e"></stop></linearGradient><radialGradient id="gnd" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="0.5"></stop><stop offset="1" stop-color="#000" stop-opacity="0"></stop></radialGradient><linearGradient id="car" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3d46"></stop><stop offset="1" stop-color="#23252b"></stop></linearGradient></defs><ellipse cx="205" cy="226" rx="200" ry="28" fill="url(#gnd)"></ellipse><polygon points="38,199.6 114,219.1 63.2,240.2 -12.8,220.7" fill="#2a2b31" opacity="0.75"></polygon><ellipse cx="318" cy="238" rx="58" ry="12" fill="url(#glow)"></ellipse><polygon points="122,210 262,246 262,182 122,146" fill="url(#wl)"></polygon><g stroke="#ffffff" stroke-opacity="0.025" stroke-width="1"><path d="M140,150.6 V214.6 M160,155.7 V219.8 M180,160.9 V224.9 M200,166 V230.1 M220,171.2 V235.2 M240,176.3 V240.3"></path></g><polygon points="196,229 212,233.1 212,195.1 196,191" fill="#24262d"></polygon><polygon points="196,229 212,233.1 212,195.1 196,191" stroke="#4a4d58" stroke-width="1"></polygon><circle cx="209" cy="215" r="1" fill="#8a8e99"></circle><polygon points="150,190.2 172,195.8 172,177.8 150,172.2" fill="url(#gw)"></polygon><path d="M161,193 V175" stroke="#2f323b" stroke-width="1.6"></path><polygon points="150,190.2 172,195.8 172,177.8 150,172.2" stroke="#2b2d35" stroke-width="1.6"></polygon><polygon points="229,217 240,219.8 240,204.8 229,202" fill="#4c505c"></polygon><path d="M235.6,205.6 l-2.4,4.2 h2.2 l-1.3,3.6" stroke="#dcdcdc" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"></path><polygon points="262,246 358,206 358,142 310,110 262,182" fill="url(#wr)"></polygon><ellipse cx="310" cy="168" rx="54" ry="54" fill="url(#glow)"></ellipse><polygon points="288,215.2 332,196.8 332,140.8 288,159.2" fill="url(#gw)"></polygon><path d="M310,206 V150 M288,187.2 L332,168.8" stroke="#30333d" stroke-width="2.4"></path><polygon points="288,215.2 332,196.8 332,140.8 288,159.2" stroke="#30333d" stroke-width="2.4"></polygon><polygon points="286,217 334,197 334,199.4 286,219.4" fill="#4a4e5a"></polygon><polygon points="162,72 318,112 262,187 106,147" fill="url(#rf)"></polygon><polygon points="106,147 262,187 262,192 106,152" fill="#23252c"></polygon><polygon points="262,187 318,112 322,113 266,188" fill="#4c5060"></polygon><polygon points="318,112 366,144 362,146 314,114" fill="#4c5060"></polygon><polygon points="262,192 266,188 322,113 318,112 262,187" fill="#1f2127" opacity="0.5"></polygon><polygon points="204,86 214,88.6 214,70.6 204,68" fill="#353843"></polygon><polygon points="214,88.6 222,85.3 222,67.3 214,70.6" fill="#2c2e36"></polygon><polygon points="204,68 214,70.6 222,67.3 212,64.7" fill="#4a4e5a"></polygon><polygon points="24,196 128,222.7 128,172.7 24,146" fill="url(#wl)"></polygon><polygon points="128,222.7 159.8,209.5 159.8,159.5 128,172.7" fill="url(#wr)"></polygon><polygon points="24,146 128,172.7 159.8,159.5 55.8,132.8" fill="#2f323b"></polygon><polygon points="24,146 128,172.7 128,169.2 24,142.5" fill="#484c58"></polygon><polygon points="128,172.7 159.8,159.5 159.8,156 128,169.2" fill="#484c58"></polygon><polygon points="24,142.5 128,169.2 159.8,156 55.8,129.3" fill="#3a3d48"></polygon><defs><linearGradient id="gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4d57"></stop><stop offset="1" stop-color="#33353d"></stop></linearGradient><radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffe6a8" stop-opacity="0.55"></stop><stop offset="1" stop-color="#ffe6a8" stop-opacity="0"></stop></radialGradient><linearGradient id="cTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f5f7"></stop><stop offset="1" stop-color="#d9dbe0"></stop></linearGradient><linearGradient id="cSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6d8de"></stop><stop offset="1" stop-color="#a9adb6"></stop></linearGradient><linearGradient id="cFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c2c5cc"></stop><stop offset="1" stop-color="#8f939c"></stop></linearGradient><linearGradient id="cGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a4250"></stop><stop offset="0.55" stop-color="#161a21"></stop><stop offset="1" stop-color="#2a303b"></stop></linearGradient></defs><polygon points="38,199.6 114,219.1 114,180.1 38,160.6" fill="url(#gd)"></polygon><path d="M38,168.4 L114,187.9" stroke="#262830" stroke-width="1"></path><path d="M38,169.2 L114,188.7" stroke="#5a5e69" stroke-width="0.5" stroke-opacity="0.6"></path><path d="M38,176.2 L114,195.7" stroke="#262830" stroke-width="1"></path><path d="M38,177.0 L114,196.5" stroke="#5a5e69" stroke-width="0.5" stroke-opacity="0.6"></path><path d="M38,184.0 L114,203.5" stroke="#262830" stroke-width="1"></path><path d="M38,184.8 L114,204.3" stroke="#5a5e69" stroke-width="0.5" stroke-opacity="0.6"></path><path d="M38,191.8 L114,211.3" stroke="#262830" stroke-width="1"></path><path d="M38,192.6 L114,212.1" stroke="#5a5e69" stroke-width="0.5" stroke-opacity="0.6"></path><polygon points="38,199.6 114,219.1 114,180.1 38,160.6" stroke="#23252c" stroke-width="1.4" fill="none"></polygon><polygon points="36,161 116,181.5 116,179 36,158.5" fill="#3e414c"></polygon><ellipse cx="76" cy="166" rx="26" ry="12" fill="url(#lamp)"></ellipse><polygon points="73,165.4 79,166.9 79,164.9 73,163.4" fill="#fff1c8"></polygon><polygon points="117.5,193.6 124,195.3 124,205.3 117.5,203.6" fill="#2a2c33" stroke="#555966" stroke-width="0.8"></polygon><circle cx="120.8" cy="197.6" r="1.1" fill="#6fd29e"></circle><g transform="translate(14 3.6) translate(-4 0.3999999999999999) translate(74 212) scale(1.5) translate(-74 -212)"><ellipse cx="50.15" cy="221.25" rx="31" ry="10" fill="#000" opacity="0.5" transform="rotate(-22 50.15 221.25)"></ellipse><ellipse cx="26.34" cy="218.42" rx="4.9" ry="5.3" fill="#0b0c0f"></ellipse><ellipse cx="26.94" cy="218.32" rx="3.4" ry="3.7" fill="#25282e"></ellipse><path d="M26.94,218.32 q1.90,0.00 2.73,1.83" stroke="#3d414a" stroke-width="0.7" fill="none"></path><path d="M26.94,218.32 q0.59,2.00 -0.75,3.40" stroke="#3d414a" stroke-width="0.7" fill="none"></path><path d="M26.94,218.32 q-1.54,1.23 -3.19,0.27" stroke="#3d414a" stroke-width="0.7" fill="none"></path><path d="M26.94,218.32 q-1.54,-1.23 -1.22,-3.23" stroke="#3d414a" stroke-width="0.7" fill="none"></path><path d="M26.94,218.32 q0.59,-2.00 2.43,-2.27" stroke="#3d414a" stroke-width="0.7" fill="none"></path><ellipse cx="26.94" cy="218.32" rx="0.7" ry="0.8" fill="#4d515a"></ellipse><polygon points="40.24,227.51 19.36,222.29 18.9,219.87 19.45,217.34 21.05,215.02 44.25,220.82 42.19,223.02 40.7,225.33" fill="url(#cFront)"></polygon><polygon points="40.24,227.51 19.36,222.29 19.59,221.25 40.01,226.35" fill="#16181c"></polygon><polygon points="36.18,226.2 23.42,223.01 23.77,222.49 35.83,225.51" fill="#2a2d33"></polygon><polygon points="82.1,210.4 82.1,202.4 80.88,201.71 57.68,210.94 55.24,212.95 51.17,215.74 47.1,218.53 44.25,220.82 42.42,223.08 41.4,225.5 40.7,227.63 42.01,227.75 81.49,211.35" fill="url(#cSide)"></polygon><path d="M80.47,203.28 L56.87,212.68" stroke="#ffffff" stroke-width="0.6" opacity="0.55"></path><polygon points="81.29,211.44 42.01,227.75 42.21,226.26 80.88,210.21" fill="#16181c"></polygon><ellipse cx="73.96" cy="213.88" rx="6.2" ry="6.6" fill="#16181c"></ellipse><ellipse cx="73.96" cy="213.88" rx="5.5" ry="5.9" fill="#0d0e11"></ellipse><ellipse cx="49.54" cy="224.02" rx="6.2" ry="6.6" fill="#16181c"></ellipse><ellipse cx="49.54" cy="224.02" rx="5.5" ry="5.9" fill="#0d0e11"></ellipse><polygon points="82.1,202.4 78.09,201.01 60.46,196.6 58.9,196.6" fill="#eef0f3"></polygon><polygon points="78.09,201.01 75.65,199.43 71.99,198.15 67.92,198.54 63.85,200.13 60.59,202.68 57.75,206.26 54.9,209.94 37.26,205.54 40.11,201.85 42.96,198.27 46.22,195.72 50.29,194.13 54.36,193.74 58.02,195.02 60.46,196.6" fill="url(#cGlass)"></polygon><polygon points="64.09,198.12 59.21,200.45 49.93,198.13 54.81,195.8" fill="#ffffff" opacity="0.1"></polygon><polygon points="57.11,203.89 54.67,207.7 50.03,206.54 52.47,202.73" fill="#ffffff" opacity="0.07"></polygon><polygon points="80.88,201.71 57.68,210.94 54.9,210.24 78.09,201.01" fill="#eef0f3"></polygon><polygon points="77.22,201.21 71.99,198.95 67.92,199.34 63.85,200.93 60.59,203.38 56.47,209.42" fill="url(#cGlass)"></polygon><path d="M77.22,201.21 L71.99,198.95 L67.92,199.34 L63.85,200.93 L60.59,203.38 L56.47,209.42" stroke="#0a0b0e" stroke-width="0.6" fill="none"></path><path d="M66.23,205.57 L65.89,200.08" stroke="#0a0b0e" stroke-width="1.3"></path><polygon points="57.68,210.94 55.24,212.95 51.17,215.74 47.1,218.53 44.25,220.82 21.05,215.02 23.9,212.73 27.97,209.94 32.04,207.15 37.26,205.84 54.9,210.24" fill="url(#cTop)"></polygon><path d="M52.05,210.84 L41.12,219.19" stroke="#ffffff" stroke-width="0.55" opacity="0.6"></path><path d="M20.97,216.09 L42.54,221.49" stroke="#f7faff" stroke-width="1" stroke-linecap="round"></path><path d="M35.76,223.78 L40.5,224.15" stroke="#1f2227" stroke-width="1.5" stroke-linecap="round"></path><path d="M24.16,220.88 L20.08,219.05" stroke="#1f2227" stroke-width="1.5" stroke-linecap="round"></path><ellipse cx="19.63" cy="230.43" rx="14" ry="4.5" fill="#eef6ff" opacity="0.12" transform="rotate(-22 19.63 230.43)"></ellipse><ellipse cx="73.96" cy="214.08" rx="4.9" ry="5.3" fill="#0b0c0f"></ellipse><ellipse cx="74.55999999999999" cy="213.98000000000002" rx="3.4" ry="3.7" fill="#25282e"></ellipse><path d="M74.56,213.98 q1.90,0.00 2.73,1.83" stroke="#3d414a" stroke-width="0.7" fill="none"></path><path d="M74.56,213.98 q0.59,2.00 -0.75,3.40" stroke="#3d414a" stroke-width="0.7" fill="none"></path><path d="M74.56,213.98 q-1.54,1.23 -3.19,0.27" stroke="#3d414a" stroke-width="0.7" fill="none"></path><path d="M74.56,213.98 q-1.54,-1.23 -1.22,-3.23" stroke="#3d414a" stroke-width="0.7" fill="none"></path><path d="M74.56,213.98 q0.59,-2.00 2.43,-2.27" stroke="#3d414a" stroke-width="0.7" fill="none"></path><ellipse cx="74.55999999999999" cy="213.98000000000002" rx="0.7" ry="0.8" fill="#4d515a"></ellipse><ellipse cx="49.54" cy="224.22" rx="4.9" ry="5.3" fill="#0b0c0f"></ellipse><ellipse cx="50.14" cy="224.12" rx="3.4" ry="3.7" fill="#25282e"></ellipse><path d="M50.14,224.12 q1.90,0.00 2.73,1.83" stroke="#3d414a" stroke-width="0.7" fill="none"></path><path d="M50.14,224.12 q0.59,2.00 -0.75,3.40" stroke="#3d414a" stroke-width="0.7" fill="none"></path><path d="M50.14,224.12 q-1.54,1.23 -3.19,0.27" stroke="#3d414a" stroke-width="0.7" fill="none"></path><path d="M50.14,224.12 q-1.54,-1.23 -1.22,-3.23" stroke="#3d414a" stroke-width="0.7" fill="none"></path><path d="M50.14,224.12 q0.59,-2.00 2.43,-2.27" stroke="#3d414a" stroke-width="0.7" fill="none"></path><ellipse cx="50.14" cy="224.12" rx="0.7" ry="0.8" fill="#4d515a"></ellipse><path d="M68.47,215.16 L68.47,206.86" stroke="#a7acb4" stroke-width="0.4"></path><path d="M58.29,218.59 L57.68,211.04" stroke="#a7acb4" stroke-width="0.4"></path><path d="M72.33,207.26 L70.7,207.88" stroke="#2a2d33" stroke-width="0.75" stroke-linecap="round"></path><path d="M63.38,210.77 L61.75,211.4" stroke="#2a2d33" stroke-width="0.75" stroke-linecap="round"></path><polygon points="55.24,214.75 54.22,214.98 54.22,215.78" fill="#22252b"></polygon><ellipse cx="58.84" cy="211.17999999999998" rx="0.7" ry="0.5" fill="#16181c"></ellipse><ellipse cx="58.84" cy="210.73" rx="1.5" ry="1" fill="#eef0f3"></ellipse><ellipse cx="80.06" cy="204.85" rx="0.9" ry="0.7" fill="#6fd29e"></ellipse></g><path d="M120.8,204.5 C121,228 113.1,221.3 93.1,205.3" stroke="#6fd29e" stroke-width="1.4" fill="none" stroke-linecap="round"></path><circle cx="93.1" cy="205.3" r="1.3" fill="#6fd29e"></circle><g stroke="#4b4e58" stroke-width="1.3" fill="none" stroke-linecap="round"><path d="M234.5,215 V240 L400,214"></path><path d="M234.5,240 L114,219.1"></path></g></svg>'; // ki-hex-ok: illustrasjonen (fast mørk scene)
  const HUS_URL = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(HUS_SVG);
  M.stromHusSvg = HUS_SVG;

  /* ------------------------------------------------------------ definisjoner (designet) */
  const TABDEF = [['Priser', 'mdi:tag-outline'], ['Forbruk', 'mdi:chart-bar'], ['Kurser', 'mdi:power-plug-outline']];
  const TABK = TABDEF.map((t) => t[0]);
  const SECS = {
    Priser: [['p_kort', 'Regning og kostnad', 'mdi:receipt-text-outline'], ['p_eks', 'Hva koster det nå', 'mdi:calculator'], ['p_graf', 'Pris time for time', 'mdi:chart-line'], ['p_minis', 'Lavest · høyest · snitt', 'mdi:function-variant'], ['p_bryt', 'Inkludert i prisen', 'mdi:toggle-switch']],
    Forbruk: [['f_kort', 'Forbruk nå og i dag', 'mdi:lightning-bolt'], ['f_stat', 'Dag · måned · år', 'mdi:meter-electric'], ['f_graf', 'Forbruk per time', 'mdi:chart-bar'], ['f_kilder', 'Kilder', 'mdi:table-large']],
    Kurser: [['k_total', 'Totalkort', 'mdi:cash-multiple'], ['k_kat', 'Kategorier', 'mdi:shape-outline'], ['k_kurs', 'Sikringsskap', 'mdi:power-plug-outline']],
  };
  // Fiks 47 T/N: roller gruppert (Tilpass → Entiteter = «Kilder»). [rolle, navn, ikon, domene-regex for søk]
  const ROLES = [['effekt', 'Effekt nå', 'mdi:meter-electric'], ['spot', 'Spotpris', 'mdi:lightning-bolt'], ['norge', 'Norgespris', 'mdi:piggy-bank-outline'], ['dag', 'Kostnad i dag', 'mdi:calendar-today'], ['maned', 'Regning måned', 'mdi:receipt-text-outline'], ['spart', 'Spart med Norgespris', 'mdi:hand-heart-outline'], ['forbruk', 'Forbruk i dag', 'mdi:lightning-bolt'],
    ['trinn', 'Effekttrinn (intervall)', 'mdi:stairs'], ['margin', 'Margin til neste trinn', 'mdi:arrow-collapse-up'], ['bil', 'Elbil / lader (bilen i toppkortet)', 'mdi:ev-station'],
    ['tg_nettleie', 'Nettleie', 'mdi:cash', /^(input_boolean|switch)\./], ['tg_selskap', 'Strømselskap', 'mdi:home-city-outline', /^(input_boolean|switch)\./], ['tg_stotte', 'Strømstøtte', 'mdi:hand-coin-outline', /^(input_boolean|switch)\./], ['tg_moms', 'Moms', 'mdi:cash-multiple', /^(input_boolean|switch)\./]];
  const ROLE_GROUPS = [['Toppkort', 'Trykk på delene i toppkortet åpner disse', ['effekt', 'spot', 'dag', 'norge', 'trinn', 'margin', 'bil']], ['Priser og forbruk', '', ['maned', 'spart', 'forbruk']], ['Inkludert i prisen', 'Brytere som styrer prisberegningen · hold inne for detaljer', ['tg_nettleie', 'tg_selskap', 'tg_stotte', 'tg_moms']]];
  const PAGES = { norgespris: ['Norgespris', 'mdi:piggy-bank-outline'], stromregning: ['Strømregning', 'mdi:receipt-text-outline'], innstillinger: ['Strøminnstillinger', 'mdi:tune'] };
  const PAGE_HASH = { '#norgespris': 'norgespris', '#stromregning': 'stromregning', '#strømregning': 'stromregning', '#strominnstillinger': 'innstillinger' };
  // «Hva koster det nå»: [id, ikon, tekst, kWh] (typiske forbruk, ikke målinger)
  const EXALL = [['dusj', 'mdi:shower', 'Dusj, 10 min', 5], ['vask', 'mdi:washing-machine', 'Klesvask, 40 °C', 1], ['oppvask', 'mdi:dishwasher', 'Oppvaskmaskin', 1.2], ['bil', 'mdi:car-electric', 'Lade bil 0–100 %', 85.2], ['ovn', 'mdi:stove', 'Steke i ovn, 1 t', 2], ['tork', 'mdi:tumble-dryer', 'Tørketrommel', 3.5], ['tv', 'mdi:television', 'TV, 1 time', 0.1], ['pizza', 'mdi:pizza', 'Pizzaovn, 20 min', 0.44], ['laptop', 'mdi:laptop', 'Lade laptop, 1 t', 0.05], ['vvb', 'mdi:water-boiler', 'Varmtvannsbereder', 9.3], ['panel', 'mdi:radiator', 'Panelovn, 1 time', 1], ['stov', 'mdi:robot-vacuum', 'Støvsuger, 30 min', 0.3], ['2kwh', 'mdi:lightning-bolt', 'Kostnad for 2 kWh', 2]];
  const EXDEF = ['dusj', 'vask', 'oppvask', 'bil', 'ovn'];
  const PRS = [['norge', 'Norgespris'], ['spot', 'Spotpris'], ['total', 'Spot + nettleie og avgifter']];
  const UC = { now: ['mdi:home-lightning-bolt-outline', 'Forbruk nå'], day: ['mdi:lightning-bolt', 'Dagens forbruk'], month: ['mdi:calendar-month', 'Denne måneden'], year: ['mdi:calendar-sync', 'I år'], cost: ['mdi:cash-multiple', 'Kostnad i dag'], peak: ['mdi:speedometer', 'Topp i dag'], step: ['mdi:stairs', 'Effekttrinn'], ev: ['mdi:ev-station', 'Elbillading'] };
  const TOGGLES = [['nettleie', 'Nettleie', 'mdi:cash', /nettleie|grid|network/], ['selskap', 'Strømselskap', 'mdi:home-city-outline', /selskap|company|paslag|surcharge|supplier/], ['stotte', 'Strømstøtte', 'mdi:hand-coin-outline', /stotte|støtte|support|subsid/], ['moms', 'Moms', 'mdi:cash-multiple', /moms|mva|vat|tax/]];
  const STEPS = [[0, 2], [2, 5], [5, 10], [10, 15], [15, 20], [20, 25]];

  /* ------------------------------------------------------------ config-hjelpere */
  const hidOf = (c) => ({ p_minis: true, ...(isObj(c && c.hid) ? c.hid : {}) });
  const orderOf = (c) => { const o = (Array.isArray(c && c.order) ? c.order : []).filter((k) => TABK.includes(k)); TABK.forEach((k) => { if (!o.includes(k)) o.push(k); }); return o; };
  const visTabs = (c) => { const h = hidOf(c), o = orderOf(c), v = o.filter((k) => !h[k]); return v.length ? v : [o[0]]; };
  const ordIds = (saved, ids) => { const o = Array.isArray(saved) ? saved : []; return [...o.filter((x) => ids.includes(x)), ...ids.filter((x) => !o.includes(x))]; };
  const secOrder = (c, tab) => ordIds(((c && c.ord) || {})['sec-' + tab], SECS[tab].map((s) => s[0]));
  const ucOf = (c) => (Array.isArray(c && c.useCards) && c.useCards.length === 2 && c.useCards.every((k) => UC[k]) && c.useCards[0] !== c.useCards[1] ? c.useCards : ['now', 'day']);
  const exPriceOf = (c) => (PRS.some((p) => p[0] === (c && c.exPrice)) ? c.exPrice : 'spot');
  const exShowOf = (c) => (Array.isArray(c && c.exShow) ? c.exShow : EXDEF);
  const tsOf = (c) => (['pille', 'kontur', 'ikoner', 'kompakt'].includes(c && c.tabStyle) ? c.tabStyle : 'pille');
  const startOf = (c) => (c && (c.start_tab || c.start)) || '';

  /* ------------------------------------------------------------ entiteter (Auto) */
  const txt = (hass, id) => (id + ' ' + String((hass.states[id] && hass.states[id].attributes.friendly_name) || '')).toLowerCase();
  const SUB_RX = /basseng|pool|spa\b|vvb|bereder|lader|charger|easee|zaptec|tesla|varmepumpe|nibe|panelovn|gulvvarme|vaskemaskin|oppvask|torketrommel|kjoleskap|server/;
  let AM = null;
  function autoEnts(hass) {
    if (!hass || !hass.states) return {};
    const pr = M.energiPrefs ? M.energiPrefs(hass) : undefined;
    if (AM && AM.s === hass.states && AM.pr === pr) return AM.v;
    const st = hass.states, ids = Object.keys(st).filter((id) => id.startsWith('sensor.') && st[id] && M.isNum(st[id].state));
    const unit = (id) => String(st[id].attributes.unit_of_measurement || '');
    const mon = ids.filter((id) => st[id].attributes.device_class === 'monetary' || /^(nok|kr|sek|eur)$/i.test(unit(id)));
    const pick = (list, inc, exc, pref) => {
      const L = list.filter((id) => inc.every((r) => r.test(txt(hass, id))) && !(exc && exc.test(txt(hass, id))));
      return L.sort((a, b) => (pref && pref.test(txt(hass, b)) ? 1 : 0) - (pref && pref.test(txt(hass, a)) ? 1 : 0) || (a < b ? -1 : 1))[0] || null;
    };
    let R = null; try { R = M.energiSources ? M.energiSources(hass, {}) : null; } catch (e) { R = null; }
    let P = null; try { P = M.powerPrice ? M.powerPrice(hass) : null; } catch (e) { P = null; }
    const pw = ids.filter((id) => st[id].attributes.device_class === 'power' || /^(k|M)?W$/.test(unit(id)));
    const sens = Object.keys(st).filter((id) => id.startsWith('sensor.') && st[id]);
    const v = {
      effekt: (R && R.power) || (M.kiRomId && M.kiRomId(hass, null, 'effekt')) || pick(pw, [/strommaler|strømmåler|\bams\b|_ams_|\bhan\b|pulse|hele_huset|house_power|total_effekt|effekt_total/], SUB_RX) || null,
      spot: (P && P.entity) || null,
      norge: (P && P.norgespris && P.norgespris.entity) || (M.norgesprisAuto && M.norgesprisAuto(hass)) || null,
      dag: pick(mon, [/(dagens_kostnad|daily_cost|cost_today|kostnad_i_dag|kostnad_idag|dagens kostnad)/], new RegExp(SUB_RX.source + '|besparelse|spart|saving|norgespris'), /strom|strøm|forbruk|total|strommaler/)
        || pick(mon, [/(daily|i_dag|i dag|idag|today|_dag\b|dagens)/, /(cost|kostnad)/], new RegExp(SUB_RX.source + '|mnd|maned|måned|month|year|aar|år\\b|besparelse|spart|saving'), /strom|strøm|total|nordpool|tibber|energi|strommaler/),
      maned: pick(mon, [/(month|maned|måned|monthly|regning|mnd)/], new RegExp(SUB_RX.source + '|besparelse|spart|saving|year|aar'), /strom|strøm|regning|total/),
      spart: pick(mon.concat(ids.filter((id) => /kr$/i.test(unit(id)))), [/(besparelse|spart|saving|saved)/, /norgespris/], null, /dag|daily|today/),
      forbruk: pick(ids.filter((id) => st[id].attributes.device_class === 'energy'), [/(daily|i_dag|idag|today|_dag\b|dagens)/, /(forbruk|energy|energi|consumption|strommaler|import)/], SUB_RX, /strommaler|total|hele|house/),
      // Fiks 47 T: søkemønstre (ingen faste ID-er) – kapasitetstrinn (intervall, ofte tekst-tilstand), margin, lader
      trinn: pick(sens, [/(kapasitetstrinn|kapasitetsledd|effekttrinn|capacity_step|capacity_tier)/], /margin|neste|next|pris|price|cost|kostnad/, /intervall|interval/),
      margin: pick(sens, [/(margin|igjen|remaining)/, /(trinn|step|tier|kapasitet)/], null, /neste|next/),
      bil: pick(pw, [/(charger_power|charging_power|easee|zaptec|wallbox|ev_charg|elbil|billader|bil_lader|tesla_.*(power|effekt))/], /solar|sol\b|battery_power|batteri|mobil|telefon|phone/, /charger_power|charging_power/),
    };
    if (!v.norge) v.norge = pick(ids, [/norgespris/, /(pris|price)/], /besparelse|spart|saving|cost|kostnad|total|forbruk|energy/, /(_na\b|_naa\b|_now|nå)/);
    if (!v.effekt) v.effekt = pick(pw, [/(_effekt\b|_effekt$|power)/], SUB_RX, /strommaler|maler|måler|meter|hus|house|total/);
    // «Inkludert i prisen»: input_boolean/switch som styrer prisberegningen (navn + pris-kontekst)
    const tgs = Object.keys(st).filter((id) => /^(input_boolean|switch)\./.test(id));
    TOGGLES.forEach(([k, , , rx]) => {
      const L = tgs.filter((id) => { const t = txt(hass, id); return rx.test(id.split('.')[1]) && /(include|inkluder|strompris|strømpris|strom_|pris|price|kalk|calc)/.test(t); });
      L.sort((a, b) => (/^input_boolean/.test(b) ? 1 : 0) - (/^input_boolean/.test(a) ? 1 : 0) || (/include|inkluder|strompris/.test(b) ? 1 : 0) - (/include|inkluder|strompris/.test(a) ? 1 : 0) || (a < b ? -1 : 1));
      v['tg_' + k] = L[0] || null;
    });
    AM = { s: st, pr, v };
    return v;
  }
  const entOf = (hass, cfg, role) => { const o = (cfg && cfg.ent) || {}; return o[role] || autoEnts(hass)[role] || null; };
  M.stromEnt = entOf;
  const stOf = (hass, id) => (id && hass && hass.states[id]) || null;
  const valOf = (hass, id) => { const s = stOf(hass, id); return s && M.isNum(s.state) ? Number(s.state) : null; };
  const wattOf = (hass, id) => { const s = stOf(hass, id); if (!s || !M.isNum(s.state)) return null; const u = String(s.attributes.unit_of_measurement || 'W'); return Number(s.state) * (/^kW$/i.test(u) ? 1000 : /^MW$/i.test(u) ? 1e6 : 1); };
  const kwhOf = (hass, id) => { const s = stOf(hass, id); if (!s || !M.isNum(s.state)) return null; const u = String(s.attributes.unit_of_measurement || 'kWh'); return Number(s.state) * (/^Wh$/i.test(u) ? 0.001 : /^MWh$/i.test(u) ? 1000 : 1); };
  const priceVal = (hass, id) => { const s = stOf(hass, id); return s && M.isNum(s.state) ? Number(s.state) * (M.priceScale ? M.priceScale(s) : 1) : null; };
  const trendOf = (hass, id) => { const s = stOf(hass, id); if (!s) return null; const a = s.attributes || {}; const v = a.endring != null ? a.endring : a.change != null ? a.change : null; if (v == null) return null; const n = parseFloat(String(v).replace(',', '.').replace('−', '-')); return isNaN(n) ? null : n; };
  // Innebygde brytere «Inkludert i prisen» (bare input_boolean.include_* som finnes)
  // Fiks 47 N: entitet per bryter = config.ent.tg_<k> (Tilpass → Entiteter) ellers autokonfig (input_boolean/switch)
  function togglesOf(hass, cfg) {
    if (!hass) return [];
    return TOGGLES.map(([k, l, icon]) => { const id = entOf(hass, cfg, 'tg_' + k); return id && hass.states[id] ? { k, l, icon, id } : null; }).filter(Boolean);
  }
  // Popupen lages når det finnes en pris- eller effekt-/energikilde
  M.stromHas = (hass) => {
    if (!hass || !hass.states) return false;
    try { if (M.powerPrice && M.powerPrice(hass).entity) return true; } catch (e) { /* */ }
    const a = autoEnts(hass);
    return !!(a.effekt || a.forbruk || a.norge) || Object.keys(hass.states).some((id) => id.startsWith('sensor.') && ['energy', 'power'].includes(hass.states[id].attributes.device_class) && /strom|strøm|ams|han|maler|måler|meter|effekt|import/.test(id));
  };
  M.popupNeeds = M.popupNeeds || {};
  M.popupNeeds[HASH] = (hass) => M.stromHas(hass);
  // #norgespris / #stromregning / #strominnstillinger → undersidene i #strom (aldri egne popups)
  M.HASH_ALIAS = M.HASH_ALIAS || {};
  Object.keys(PAGE_HASH).forEach((h) => { M.HASH_ALIAS[h] = HASH; });

  /* ------------------------------------------------------------ pris */
  function priceOf(card) {
    const h = card.hass, spot = card.ent('spot');
    try { return M.powerPrice(h, M.powerPriceCfg(null, { spot_entity: spot || '', mode: 'spot', unit: 'kr', source: spot ? '' : undefined }), card); } catch (e) { return null; }
  }
  const avgOf = (a) => { const v = (a || []).filter((x) => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  // Nivå: prisens eget nivå-attributt, ellers forhold til dagens snitt
  function levelOf(v, avg, attr) {
    const t = String(attr || '').toUpperCase();
    if (t === 'VERY_CHEAP' || t === 'CHEAP') return 0;
    if (t === 'NORMAL') return 1;
    if (t === 'EXPENSIVE' || t === 'VERY_EXPENSIVE') return 2;
    if (v == null || !avg) return null;
    const r = v / avg;
    return r < 0.9 ? 0 : r <= 1.1 ? 1 : 2;
  }
  const LVL = [['Billig', GREEN_F], ['Middels', AMBER_F], ['Dyrt', RED_F]];

  /* ------------------------------------------------------------ statistikk (bare mens popupen er åpen, 5 min cache) */
  const tOf = (r) => (typeof r.start === 'number' ? r.start : Date.parse(r.start));
  const dayStart = (off) => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate() + (off || 0)); };
  const stats = (hass, ids, s, e, period) => (ids.length ? hass.callWS({ type: 'recorder/statistics_during_period', start_time: s.toISOString(), end_time: e.toISOString(), statistic_ids: ids, period, types: ['change'], units: { energy: 'kWh', volume: 'L' } }).catch(() => null).then((r) => r || {}) : Promise.resolve({}));
  const uniq = (a) => [...new Set(a.filter(Boolean))];
  const ser24 = (st, ids) => { const out = Array(24).fill(null); ids.forEach((id) => (st[id] || []).forEach((r) => { if (r.change == null) return; const i = new Date(tOf(r)).getHours(); out[i] = (out[i] || 0) + Number(r.change); })); return out; };
  const sum = (a) => (a || []).reduce((s, v) => s + (v || 0), 0);
  const anyV = (a) => (a || []).some((v) => v != null);
  async function loadDay(hass, R, off, P) {
    const s = dayStart(off), e = dayStart(off + 1);
    const ids = uniq([...R.grid_in, ...R.grid_out, ...R.cost_in, ...R.solar, ...(R.battery || []), ...R.water, ...R.water_cost, R.ev]);
    const st = await stats(hass, ids, s, e, 'hour');
    const imp = ser24(st, R.grid_in), exp = ser24(st, R.grid_out), sol = ser24(st, R.solar), bat = ser24(st, R.battery || []);
    const ev = R.ev ? ser24(st, [R.ev]) : Array(24).fill(null);
    let cost = R.cost_in.length ? ser24(st, R.cost_in) : null;
    if (cost && !anyV(cost)) cost = null;
    if (!cost && off === 0 && P && anyV(P.spotToday)) cost = imp.map((v, i) => (v == null || P.today[i] == null ? null : v * P.today[i]));
    const per = R.grid_in.map((id) => ({ id, vals: ser24(st, [id]) }));
    const water = ser24(st, R.water);
    let wcost = R.water_cost.length ? ser24(st, R.water_cost) : null;
    if (wcost && !anyV(wcost)) wcost = null;
    return { off, imp, exp, sol, bat, ev, cost, per, water, wcost, t: Date.now() };
  }
  async function loadMonth(hass, R) {
    const n = new Date(), s = new Date(n.getFullYear(), n.getMonth(), 1), e = new Date(n.getTime() + HOUR);
    const st = await stats(hass, uniq([...R.grid_in, ...R.cost_in]), s, e, 'hour');
    const byDay = {}; let kwh = null, cost = null;
    R.grid_in.forEach((id) => (st[id] || []).forEach((r) => { if (r.change == null) return; const t = tOf(r), d = new Date(t), k = d.getDate(); const v = Number(r.change); kwh = (kwh || 0) + v; byDay[k] = byDay[k] || {}; byDay[k][d.getHours()] = (byDay[k][d.getHours()] || 0) + v; }));
    R.cost_in.forEach((id) => (st[id] || []).forEach((r) => { if (r.change != null) cost = (cost || 0) + Number(r.change); }));
    const peaks = Object.keys(byDay).map((d) => { const hs = byDay[d], mx = Math.max(...Object.values(hs)); return { d: Number(d), v: mx }; }).sort((a, b) => b.v - a.v);
    const top = peaks.slice(0, 3);
    return { kwh, cost, peaks: top, avg3: top.length ? top.reduce((a, p) => a + p.v, 0) / top.length : null, t: Date.now() };
  }
  async function loadYear(hass, R) {
    const n = new Date(), s = new Date(n.getFullYear(), 0, 1), e = new Date(n.getTime() + HOUR);
    const st = await stats(hass, uniq(R.grid_in), s, e, 'month');
    let kwh = null; R.grid_in.forEach((id) => (st[id] || []).forEach((r) => { if (r.change != null) kwh = (kwh || 0) + Number(r.change); }));
    return { kwh, t: Date.now() };
  }

  /* ------------------------------------------------------------ fanelinje (4 stiler, designets TSTY) */
  const pillS = (on, h) => `height:${h}px;padding:0 16px;white-space:nowrap;border-radius:999px;font-size:14px;font-weight:500;background:${on ? PINK : 'transparent'};color:${on ? INK : T1};transition:background .25s,color .25s,transform .18s,box-shadow .18s,flex .25s`;
  const TSTY = {
    pille: { name: 'Pille', sub: 'Ikon + tekst', wrap: '', bar: `display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:4px;padding:4px;border-radius:999px;background:${SURF}`,
      btn: (on) => `${pillS(on, 44)};padding:0 8px;display:flex;align-items:center;justify-content:center;gap:6px`, icon: () => true, label: () => true },
    kontur: { name: 'Kontur', sub: 'Standard', wrap: 'justify-content:center', bar: `display:flex;gap:2px;padding:2px;border-radius:999px;box-shadow:inset 0 0 0 1px ${WA(0.3)}`,
      btn: (on) => `${pillS(on, 40)};padding:0 20px;display:flex;align-items:center;justify-content:center;color:${on ? INK : 'var(--ki-text-1, rgba(255,255,255,.72))'};box-shadow:${on ? '0 1px 6px ' + KA(0.35) : 'none'}`, icon: () => false, label: () => true }, // ki-hex-ok: fallback uten tema / mørk fallback
    ikoner: { name: 'Ikoner', sub: 'Aktiv viser tekst', wrap: '', bar: `display:flex;gap:2px;padding:4px;border-radius:24px;background:var(--ki-surface, #3a3a3a);box-shadow:inset 0 0 0 1px ${WA(0.05)}`,
      btn: (on) => `flex:${on ? '1 0 auto' : '0 0 52px'};height:44px;padding:${on ? '0 16px 0 12px' : '0'};border-radius:20px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:600;white-space:nowrap;background:${on ? PINK : 'transparent'};color:${on ? INK2 : 'var(--ki-text-2, #afafaf)'};transition:flex .25s,background .25s,transform .18s,box-shadow .18s`, icon: () => true, label: (on) => on },
    kompakt: { name: 'Kompakt', sub: 'Lav, nøytral', wrap: '', bar: `display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:2px;padding:3px;border-radius:14px;background:${KA(0.25)}`,
      btn: (on) => `height:34px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;white-space:nowrap;background:${on ? 'var(--ki-ctrl, #545454)' : 'transparent'};color:${on ? T : 'var(--ki-text-2, #afafaf)'};transition:background .2s,transform .18s,box-shadow .18s`, icon: () => false, label: () => true },
  };
  // preview: spans uten roller (Tilpass → Visning)
  function tabBarHTML(c, cur, preview, styleKey) {
    const k = styleKey || tsOf(c), S = TSTY[k], V = visTabs(c), act = V.includes(cur) ? cur : V[0];
    const items = V.map((l, i) => {
      const on = preview ? i === 0 : l === act, icon = (TABDEF.find((t) => t[0] === l) || [])[1];
      const inner = `${S.icon(on) ? ic(icon, 18) : ''}${S.label(on) ? `<span>${esc(l)}</span>` : ''}`;
      return preview ? `<span style="${S.btn(on)}">${inner}</span>` : `<button class="tb${on ? ' on' : ''}" data-act="tab" data-v="${esc(l)}" data-haptic="selection" title="${esc(l)}" aria-selected="${on}" style="${S.btn(on)}">${inner}</button>`;
    }).join('');
    const bar = `${S.bar};${S.wrap ? '' : 'flex:1;min-width:0;'}`;
    return `<div class="tbw" style="flex:1;min-width:0;display:flex;${S.wrap}"><div class="tbar" ${preview ? '' : 'data-glass-drag="x" data-tabbar'} style="${bar}">${items}</div></div>`;
  }

  /* ------------------------------------------------------------ CSS (kort) */
  const CSS = `
    :host{--s-card:${SURF};--s-in:${SURF2};--ln:${WA(0.08)}}
    @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    @keyframes glowP{0%,100%{opacity:.75}50%{opacity:1}}
    @keyframes ping{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.6);opacity:0}}
    @keyframes grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
    @keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
    .wrap{display:flex;flex-direction:column;gap:12px}
    .na .wrap *{animation:none !important}
    button{text-align:inherit}
    .hero{position:relative;min-height:250px;border-radius:28px;overflow:hidden;background:radial-gradient(ellipse 55% 50% at 70% 55%,rgba(242,176,79,.22),transparent 70%),linear-gradient(175deg,#1f232c 0%,#272d39 55%,#313948 100%);padding:16px 18px 18px;display:flex;flex-direction:column;color:var(--ki-text, #fafafa)}
    .hglow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 40% 38% at 72% 52%, rgba(242,176,79,.28), transparent 70%);animation:glowP 4s ease-in-out infinite}
    .hgear{position:absolute;top:14px;right:14px;z-index:2;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.1);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;color:var(--ki-text, #fafafa);transition:transform .15s} /* ki-hex-ok: glass på mørk øy / aksentflate */
    .hgear:active,.tgear:active,.back:active{transform:scale(.92)}
    .hus{position:absolute;right:-6px;top:6px;height:calc(100% - 96px);width:auto;max-width:58%;object-fit:contain;object-position:right bottom;pointer-events:none;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 6%);mask-image:linear-gradient(90deg,transparent 0,#000 6%)}
    .hhit{-webkit-mask-image:none;mask-image:none;overflow:visible;z-index:1}.hhit foreignObject{overflow:visible}
    .hhit .hz{display:block;width:100%;height:100%;padding:0;margin:0;border:0;background:transparent;pointer-events:auto;cursor:pointer;-webkit-tap-highlight-color:transparent;outline:none;border-radius:16px}
    .hhit .hz-hus{border-radius:0;clip-path:polygon(0% 40.23%,9.06% 32.76%,40.35% 0%,85.96% 22.99%,100% 41.38%,97.66% 77.01%,69.59% 100%,30.41% 86.78%,0% 71.26%)}
    .hero .hmi{cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .15s;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;outline:none}.hero .hmi:active{transform:scale(.97)}.hero .hmi:focus-visible{outline:2px solid rgb(255 255 255 / .6);outline-offset:2px}
    .hw.hmi,.hchip.hmi{position:relative;z-index:2}.htiles .ht.hmi{position:relative;z-index:2}
    .hchip.ph{visibility:hidden;pointer-events:none}
    .hnow{position:relative;display:flex;flex-direction:column;gap:4px;margin-top:4px}
    .hlab{font-size:12px;letter-spacing:.08em;color:var(--ki-text-2, #b8b8b8)}
    .hw{align-self:flex-start;display:flex;align-items:baseline;gap:6px}.hw b{font-size:64px;font-weight:300;letter-spacing:-0.03em;line-height:1;font-variant-numeric:tabular-nums}.hw span{font-size:18px;color:var(--ki-text-2, #b8b8b8)}
    .hchip{align-self:flex-start;display:flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:999px;background:rgba(242,176,79,.18);font-size:11px;font-weight:500;color:rgb(246 200 130);margin-top:4px;white-space:nowrap}
    .pdot{position:relative;width:6px;height:6px;flex:none}.pdot i{position:absolute;inset:0;border-radius:50%;background:rgb(242 176 79)}.pdot i.pg{animation:ping 1.8s cubic-bezier(0,0,.2,1) infinite}
    .htiles{position:relative;margin-top:auto;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding-top:18px}
    .ht{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:16px;background:rgba(0,0,0,.28);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);min-width:0} /* ki-hex-ok: glass på mørk øy / aksentflate */
    .ht .l{font-size:11px;color:var(--ki-text-2, #b8b8b8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ht .v{font-size:18px;font-weight:500;white-space:nowrap}
    .ht.trinn{gap:6px}.ht .bar{height:4px;border-radius:2px;background:rgba(255,255,255,.14);overflow:hidden;margin-top:4px}.ht .bar i{display:block;height:100%;background:#f2b04f}.ht .s{font-size:10px;color:var(--ki-text-2, #b8b8b8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis} /* ki-hex-ok: glass på mørk øy / aksentflate */
    .tabrow{display:flex;align-items:center;gap:8px}
    .tbar>button{user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
    .tgear{width:52px;height:52px;flex:none;border-radius:50%;background:${SURF};display:flex;align-items:center;justify-content:center;animation:fade .25s ease;transition:transform .15s}
    .secs{display:flex;flex-direction:column;gap:12px}
    .sec{display:flex;flex-direction:column;gap:12px;border-radius:26px;transition:transform .18s,box-shadow .18s;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
    .lift{transform:scale(1.03);box-shadow:0 14px 30px ${KA(0.45)};position:relative;z-index:5}
    .fade{animation:fade .3s ease}
    .k2{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:10px}
    .bill{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:14px 16px 16px;border-radius:26px;background:${PINK};color:${INK};text-align:left;min-height:168px}
    .bill .bi{border-radius:50%;background:rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;flex:none} /* ki-hex-ok: glass på mørk øy / aksentflate */
    .bill .bl{margin-top:auto;font-size:14px}.bill .bv{display:flex;align-items:baseline;gap:5px}.bill .bv small{font-size:13px;font-weight:500}.bill .bs{font-size:12px;opacity:.75;margin-top:4px}
    .kcol{display:flex;flex-direction:column;gap:10px;min-width:0}
    .kc{position:relative;flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;gap:2px;padding:12px 14px;border-radius:22px;background:var(--s-card);text-align:left}
    .kc .ci{width:36px;height:36px;border-radius:50%;background:var(--s-in);display:flex;align-items:center;justify-content:center;margin-bottom:auto}
    .kc .cl{font-size:13px;color:${T1};margin-top:10px}.kc .cs{display:flex;align-items:center;gap:6px;font-size:12px;color:${T2}}
    .kc .cv{display:flex;align-items:baseline;gap:4px}.kc .cv small{font-size:12px;color:${T2}}
    .exr{display:flex;align-items:center;gap:10px;min-height:52px;padding:0 14px 0 16px;border-radius:999px;background:var(--s-card);text-align:left;width:100%}
    .exr .t{flex:1;font-size:15px;font-weight:500;white-space:nowrap}.exr .h{font-size:12px;color:${T2};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    .chev{transition:transform .25s;color:${T2}}.chev.up{transform:rotate(180deg)}
    .exl{background:var(--s-card);border-radius:26px;padding:4px 16px;animation:fade .25s ease}
    .exi{display:flex;align-items:center;gap:12px;min-height:64px}.exi+.exi{border-top:1px solid var(--ln)}
    .ico{width:40px;height:40px;border-radius:50%;background:var(--s-in);display:flex;align-items:center;justify-content:center;flex:none}
    .exi .n{flex:1;min-width:0;display:flex;flex-direction:column}.exi .n b{font-size:15px;font-weight:500}.exi .n span{font-size:12px;color:${T2B}}
    .exi .v{font-size:17px;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}.exi .v small{font-size:12px;font-weight:400;color:${T2B}}
    .gc{background:var(--s-card);border-radius:26px;padding:16px 16px 14px;display:flex;flex-direction:column;gap:14px;animation:fade .3s ease}
    .gh{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
    .gh .sl{font-size:13px;color:${T2}}.gh .sv{display:flex;align-items:baseline;gap:5px}.gh .sv b{font-size:40px;font-weight:300;line-height:1;font-variant-numeric:tabular-nums}.gh .sv small{font-size:13px;color:${T2}}
    .lchip{align-self:flex-start;height:22px;padding:0 10px;border-radius:999px;display:flex;align-items:center;font-size:12px;font-weight:600;color:rgba(30,24,20,.9);margin-top:4px}
    .seg{display:flex;gap:2px;padding:3px;border-radius:999px;background:${KA(0.25)};flex:none}
    .seg button{display:flex;align-items:center;justify-content:center;text-align:center;height:32px;padding:0 12px;border-radius:999px;font-size:13px;font-weight:500;white-space:nowrap;color:${T1};transition:background .25s,color .25s}
    .seg button.on{background:${PINK};color:${INK}}
    .pc{position:relative;height:180px;margin:4px 0 20px 34px}
    .pc .gl{position:absolute;left:0;right:0;border-top:1px solid ${WA(0.08)}}.pc .gl.z{border-top-color:${WA(0.3)}}
    .pc .yl{position:absolute;right:calc(100% + 8px);transform:translateY(-50%);font-size:11px;color:${T2};font-variant-numeric:tabular-nums}
    .pc svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
    .pc .band{position:absolute;top:0;bottom:0;background:${WA(0.07)};pointer-events:none}
    .pc .nl{position:absolute;top:0;bottom:0;border-left:1.5px dashed rgb(242 176 110);pointer-events:none}
    .pc .nt{position:absolute;top:-2px;transform:translateX(-50%);padding:2px 5px;border-radius:4px;background:rgb(246 190 140);color:#3a2a1e;font-size:10px;font-weight:600;pointer-events:none}
    .pc .sd{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:${T};box-shadow:0 0 0 3px rgb(242 133 201);pointer-events:none}
    .pc .scrub{position:absolute;inset:0;display:flex;touch-action:none;cursor:pointer}.pc .scrub>span{flex:1;min-width:0;height:100%}
    .pc .xl{position:absolute;top:calc(100% + 6px);transform:translateX(-50%);font-size:11px;color:${T2}}
    .pc .none{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-size:13px;color:${T2};padding:0 12px}
    .lg{display:flex;gap:16px;font-size:11px;color:${T2}}.lg span{display:flex;align-items:center;gap:6px}
    .minis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .mi{background:var(--s-card);border-radius:20px;padding:12px 14px;display:flex;flex-direction:column;gap:4px;min-width:0}
    .mi .l{display:flex;align-items:center;gap:5px;font-size:12px;color:${T2}}.mi .v{font-size:20px;font-weight:500;font-variant-numeric:tabular-nums}.mi .s{font-size:12px;color:${T2}}
    .sh2{display:flex;align-items:center;justify-content:space-between;padding:6px 6px 0}.sh2 b{font-size:15px;font-weight:600}
    .ib{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:${T2}}
    .tg2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .tg{position:relative;overflow:hidden;display:flex;align-items:center;gap:14px;min-height:72px;height:72px;box-sizing:border-box;padding:0 16px 0 10px;border-radius:999px;text-align:left;background:var(--ki-surface, #3a3a3a);color:${T};box-shadow:inset 0 0 0 1px ${WA(0.05)};transition:background .25s,color .25s,transform .15s;min-width:0;touch-action:pan-y;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
    .tg:active{transform:scale(.97)}
    .tg .th{position:absolute;top:6px;left:50%;width:32px;height:3px;margin-left:-16px;border-radius:2px;background:${WA(0.12)};pointer-events:none;transition:background .25s}
    .tg .ti{width:52px;height:52px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;background:var(--ki-surface-2, #4a4a4a);color:${T1};transition:background .25s,color .25s}
    .tg .tn{display:flex;flex-direction:column;align-items:flex-start;line-height:1.25;min-width:0}.tg .tn b{font-size:15px;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tg .tn span{font-size:13px;color:${TM};transition:color .25s}
    .tg.on{background:${TG_ON};color:var(--ki-on-accent, #2a1720);box-shadow:none}
    .tg.on .th{background:rgb(255 255 255 / .4)}
    .tg.on .ti{background:rgba(42,23,32,.08);color:var(--ki-on-accent, #2a1720)}
    .tg.on .tn span{color:rgba(42,23,32,.6)}
    .uc2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;animation:fade .3s ease}
    .uc{background:var(--s-card);border-radius:26px;padding:14px 16px 16px;display:flex;flex-direction:column;gap:2px;min-height:156px;transition:transform .18s,box-shadow .18s;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;min-width:0}
    .uc .ui{width:48px;height:48px;border-radius:50%;background:var(--s-in);display:flex;align-items:center;justify-content:center;margin-bottom:auto}
    .uc .ul{font-size:14px;color:${T1};margin-top:18px}.uc .uv{display:flex;align-items:baseline;gap:5px;min-width:0}.uc .uv b{font-size:34px;font-weight:300;line-height:1.05;font-variant-numeric:tabular-nums;white-space:nowrap}.uc .uv small{font-size:13px;color:${T2}}
    .fh{display:flex;align-items:center;gap:10px;padding:4px 6px 0}.fh b{font-size:15px;font-weight:600}.fh span{font-size:13px;color:${T2}}
    .fs{background:var(--s-card);border-radius:26px;padding:4px 18px}
    .fr{display:flex;align-items:center;gap:8px;min-height:52px;border-bottom:1px solid ${WA(0.1)};transition:transform .18s,box-shadow .18s,background .18s;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
    .fr:last-child{border-bottom:0}.fr.lift{border-radius:14px;background:var(--ki-surface-2, #4a4a4a);padding:0 10px;margin:0 -10px}
    .fr .l{flex:1;font-size:14px;color:${T1B}}.fr .v{font-size:32px;font-weight:300;font-variant-numeric:tabular-nums}.fr .u{width:30px;font-size:12px;color:${T2}}.fr .a{width:18px;display:flex}
    .dh{display:flex;align-items:center;gap:6px;padding:6px 8px}.dh .dl{flex:1;font-size:20px;font-weight:500;margin-left:6px}
    .dnow{height:32px;padding:0 12px;border-radius:999px;background:rgba(80,170,220,.2);color:var(--ki-blue-text, rgb(110 190 235));font-size:13px;font-weight:600}
    .r40{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center}.r40[disabled]{opacity:.35}
    .bc{background:var(--s-card);border-radius:26px;padding:16px 14px 14px 10px;display:flex;flex-direction:column;gap:12px}
    .ba{position:relative;height:230px;margin-left:24px;margin-bottom:20px}
    .ba .gl{position:absolute;left:0;right:0;border-top:1px solid ${WA(0.1)}}.ba .gl.z{border-top-color:${WA(0.35)}}
    .ba .yl{position:absolute;right:calc(100% + 8px);transform:translateY(-50%);font-size:11px;color:${T1B}}
    .ba .ku{position:absolute;left:-2px;top:-14px;font-size:11px;color:${T2}}
    .ba .cols{position:absolute;inset:0;display:flex;gap:3px;align-items:flex-end;padding:0 2px}
    .ba .col{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;min-width:0}
    .ba .col i{display:block;transform-origin:bottom;box-sizing:border-box}
    .ba .xl{position:absolute;top:calc(100% + 8px);transform:translateX(-50%);font-size:11px;color:${T1B};white-space:nowrap}
    .ba .none{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:13px;color:${T2}}
    .leg{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 14px;font-size:12px;color:${T1B}}.leg span{display:flex;align-items:center;gap:6px}
    .src{background:var(--s-card);border-radius:26px;padding:14px 16px 8px}
    .srh{display:grid;grid-template-columns:minmax(0,1fr) 78px 70px;gap:8px;font-size:13px;color:${T1B};padding:0 0 8px 26px}
    .srr{display:grid;grid-template-columns:14px minmax(0,1fr) 78px 70px;gap:8px;align-items:center;min-height:40px;font-size:13px}
    .srr.tot{font-weight:600;border-top:1px solid ${WA(0.1)}}
    .srr .d{width:12px;height:12px;border-radius:50%}.srr .n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.srr .e{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    .empty2{display:flex;align-items:center;gap:10px;padding:14px 16px;border-radius:22px;background:var(--s-card);color:${T2};font-size:13px}
    .ph{display:flex;align-items:center;gap:10px;padding:0 4px}
    .ph .back{width:40px;height:40px;border-radius:50%;background:${SURF};display:flex;align-items:center;justify-content:center;transition:transform .15s}
    .ph .pt{flex:1;font-size:24px;font-weight:500}.ph .pt.big{font-size:28px}
    .ph .pi{width:40px;height:40px;border-radius:50%;background:var(--ki-pill-bg, #e8e8e8);color:var(--ki-pill-fg, #2a2a2a);display:flex;align-items:center;justify-content:center}.ph .pi.s36{width:36px;height:36px}
    .ph .x{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center}
  `;

  /* ------------------------------------------------------------ kortet */
  class StromCard extends M.Card {
    static get cardName() { return 'Strøm'; }
    static get description() { return 'Strøm-popup (#strom): toppkort, priser, forbruk, kurser og undersider'; }
    static get defaults() { return {}; }
    static getStubConfig() { return { card_id: M.uid() }; }
    static getConfigElement() { return document.createElement('msh-strom-editor'); }
    static get uiPersist() { return ['tab', 'ex', 'pday']; }
    static get startTabSpec() { return { tabs: (card) => visTabs(card.config), legacy: (cfg) => cfg.start }; }
    get holdMs() { return 500; } // Fiks 47 N/T: hold 500 ms → more-info (data-ent: «Inkludert i prisen», Trinn → margin)
    constructor() {
      super();
      this._st = { day: new Map(), month: null, year: null, busy: new Set() };
      this._onPrefs = () => { this._load(true); this.update(); };
      this._holdInit();
    }
    setConfig(c) {
      const prev = this._rawConfig && this._rawConfig.card_id;
      super.setConfig(c);
      const id = this._rawConfig && this._rawConfig.card_id;
      if (id && id !== prev) { const saved = M.uiLoad(id); Object.keys(saved).forEach((k) => { if (!(k in this._ui) && !TRANSIENT.has(k)) this._ui[k] = saved[k]; }); } // B/C-nøkler (host.ui) tas også med
    }
    connectedCallback() { super.connectedCallback(); window.addEventListener('msh-energi-prefs', this._onPrefs); }
    disconnectedCallback() { super.disconnectedCallback(); window.removeEventListener('msh-energi-prefs', this._onPrefs); if (this._tp && this._tp.ov) this._tp.ov.close(); }

    /* ---------------- vertsgrensesnittet (modulene B og C) */
    get root() { return this.shadowRoot; }
    get anim() { return this.config.anim !== false; }
    haptic(t) { M.haptic(t || 'light'); }
    ent(role) { return entOf(this.hass, this.config, role); }
    sec(tab) { const h = hidOf(this.config); return secOrder(this.config, tab).filter((k) => !h[k]); }
    setCfg(patch) {
      if (!patch) return;
      if (M.mshPatchConfig) return M.mshPatchConfig(this, patch);
      const old = this._rawConfig || {}, next = { ...old, ...patch };
      Object.keys(patch).forEach((k) => { if (patch[k] == null) delete next[k]; });
      this.setConfig(next);
      return M.saveCardConfig && M.saveCardConfig(this.hass, old, next, { card: this });
    }
    // MSH.Card._render kaller render() for HTML-en; modulene (B/C) kaller host.render() for å tegne på nytt
    _render() { this._inR = true; try { return super._render(); } finally { this._inR = false; } }
    render() { if (this._inR) return this._html(); this._persistUI(); this.update(); return ''; }
    go(page) {
      const p = page && PAGES[page] ? page : null;
      this.setUI({ page: p });
      const cont = M.popupContainer ? M.popupContainer(this) : null;
      try { const sc = cont && (cont.closest ? cont.closest('.bubble-pop-up') : null); [cont, sc].forEach((x) => { if (x && x.scrollTop) x.scrollTop = 0; }); } catch (e) { /* */ }
    }
    saveUi() { this._persistUI(); }
    _persistUI() { const id = this._rawConfig && this._rawConfig.card_id; if (!id) return; const o = {}; Object.keys(this._ui).forEach((k) => { if (!TRANSIENT.has(k)) o[k] = this._ui[k]; }); M.uiStore(id, o); }
    setUI(p, quiet) { super.setUI(p, quiet); this._persistUI(); }

    /* ---------------- åpne/lukke: data hentes bare mens popupen er åpen */
    onOpen() {
      const pg = M.__stromPage;
      if (pg && Date.now() - pg.t < 8000) { M.__stromPage = null; this._ui.page = pg.page; }
      this._wSnap = null;
      if (M.energiPrefs) M.energiPrefs(this.hass);
      this._load();
      this._schedule(true);
    }
    onClose() { if (this._ui.page) { this._ui.page = null; } this._ui.selH = null; }
    _R() { const h = this.hass; if (!h || !M.energiSources || !M.energiPrefs) return null; const p = M.energiPrefs(h); if (p === undefined) return null; try { return M.energiSources(h, {}); } catch (e) { return null; } }
    _load(force) {
      if (!this.isOpen || !this.hass || !this.hass.callWS) return;
      const R = this._R();
      if (!R || !R.grid_in.length) return;
      const sig = JSON.stringify([R.grid_in, R.cost_in, R.ev, R.grid_out]);
      if (sig !== this._sig) { this._sig = sig; this._st.day.clear(); this._st.month = null; this._st.year = null; }
      const P = priceOf(this), B = this._st.busy, now = Date.now();
      const run = (key, fn, put) => { if (B.has(key)) return; B.add(key); fn().then((d) => { put(d); }).catch(() => { /* */ }).finally(() => { B.delete(key); this.update(); }); };
      [0, this._ui.fday || 0].forEach((off) => { const d = this._st.day.get(off); if (force || !d || now - d.t > TTL) run('d' + off, () => loadDay(this.hass, R, off, P), (d2) => this._st.day.set(off, d2)); });
      if (force || !this._st.month || now - this._st.month.t > TTL) run('m', () => loadMonth(this.hass, R), (d) => { this._st.month = d; });
      if (force || !this._st.year || now - this._st.year.t > TTL) run('y', () => loadYear(this.hass, R), (d) => { this._st.year = d; });
    }

    /* ---------------- verdier */
    _vals() {
      const h = this.hass, c = this.config, V = {};
      V.P = priceOf(this);
      const P = V.P || {};
      // effekt (W) – «Live effekt» av: verdien fryses ved åpning
      const wE = this.ent('effekt'); let w = wattOf(h, wE);
      if (c.live === false) { if (this._wSnap == null && w != null) this._wSnap = w; w = this._wSnap != null ? this._wSnap : w; }
      V.watt = w; V.wattE = wE;
      V.spot = P.spotNow != null ? P.spotNow : null;
      const avg = avgOf(P.spotToday);
      V.lvl = levelOf(V.spot, avg, P.state && (P.state.attributes.price_level || P.state.attributes.level));
      const nE = this.ent('norge');
      V.norge = nE ? priceVal(h, nE) : P.norgespris ? P.norgespris.v : null;
      const d0 = this._st.day.get(0), mo = this._st.month, yr = this._st.year;
      // kostnad i dag
      const dE = this.ent('dag');
      V.dag = dE ? valOf(h, dE) : d0 && d0.cost ? sum(d0.cost) : null;
      // regning måned
      const mE = this.ent('maned');
      V.maned = mE ? valOf(h, mE) : mo && mo.cost != null ? mo.cost : null;
      V.manedEst = !!mE;
      // spart med Norgespris i dag
      const sE = this.ent('spart');
      if (sE) V.spart = valOf(h, sE);
      else if (d0 && V.norge != null && anyV(P.spotToday)) { let s = null; d0.imp.forEach((k, i) => { if (k != null && P.spotToday[i] != null) s = (s || 0) + k * (P.spotToday[i] - V.norge); }); V.spart = s; } else V.spart = null;
      // forbruk i dag / måned / år
      const fE = this.ent('forbruk');
      V.dayKwh = fE ? kwhOf(h, fE) : d0 && anyV(d0.imp) ? sum(d0.imp) : null;
      const sib = (rx) => { if (!fE) return null; const id = fE.replace(/(daily|_dag|i_dag|today)(?=$|_)/, rx); return id !== fE && h.states[id] ? id : null; };
      const fM = sib('monthly') || sib('maned'), fY = sib('yearly') || sib('aar');
      V.monthKwh = fM ? kwhOf(h, fM) : mo ? mo.kwh : null;
      V.yearKwh = fY ? kwhOf(h, fY) : yr ? yr.kwh : null;
      V.trend = { day: trendOf(h, fE), month: trendOf(h, fM), year: trendOf(h, fY) };
      V.ev = d0 && anyV(d0.ev) ? sum(d0.ev) : null;
      V.peak = d0 && anyV(d0.imp) ? Math.max(...d0.imp.filter((x) => x != null)) : null;
      // effekttrinn (snitt av tre døgntopper denne måneden)
      V.avg3 = mo ? mo.avg3 : null;
      if (V.avg3 != null) { const i = STEPS.findIndex(([a, b]) => V.avg3 < b); const S = STEPS[i < 0 ? STEPS.length - 1 : i]; V.step = { lo: S[0], hi: S[1], pct: Math.max(0, Math.min(1, (V.avg3 - S[0]) / (S[1] - S[0]))), left: Math.max(0, S[1] - V.avg3) }; } else V.step = null;
      V.d0 = d0; V.mo = mo;
      return V;
    }

    /* ---------------- tegning */
    _html() {
      const c = this.config, u = this._ui, page = u.page && PAGES[u.page] ? u.page : null;
      const V = this._vals();
      if (page) return `<div class="wrap${this.anim ? '' : ' na'}">${this._pageHTML(page)}</div>`;
      const vis = visTabs(c), tab = vis.includes(u.tab) ? u.tab : vis[0];
      const gearTab = c.gear === 'tab';
      return `<div class="wrap${this.anim ? '' : ' na'}">
        ${this._heroHTML(V, !gearTab)}
        <div class="tabrow">${tabBarHTML(c, tab)}${gearTab ? `<button class="tgear" data-act="tilpass" data-tr-fixed title="Tilpass strøm">${ic('mdi:cog', 22)}</button>` : ''}</div>
        ${this._tabHTML(tab, V)}
      </div>`;
    }
    _heroHTML(V, gear) {
      const c = this.config, lv = V.lvl, st = V.step, h = this.hass;
      const chip = V.spot != null ? `Spotpris ${lv != null ? LVL[lv][0].toLowerCase() : ''}${lv != null ? ' · ' : ''}${nf(V.spot, 2)} kr` : 'Spotpris –';
      const watt = V.watt != null ? Math.round(V.watt).toLocaleString('nb-NO') : '–';
      const showChip = c.spot_chip !== false && c.spotChip !== false; // Fiks 47 M (spotChip = designets navn)
      // Fiks 47 T: hver del er en egen trykkflate → more-info (haptic light, scale .97). Mangler entitet → ingen handling/animasjon.
      const ex = (id) => !!(id && h && h.states && h.states[id]);
      const mi = (id, cls, extra) => (ex(id) ? `class="${cls} hmi" role="button" tabindex="0" data-act="mi" data-id="${esc(id)}" data-haptic="light"${extra || ''}` : `class="${cls}"`);
      const eE = this.ent('effekt'), sE = V.P && V.P.entity ? V.P.entity : this.ent('spot'), dE = this.ent('dag'), nE = this.ent('norge'), tE = this.ent('trinn'), mE = this.ent('margin');
      // Trinn: statistikk (snitt av tre døgntopper), ellers trinn-/margin-sensorene
      const tS = ex(tE) ? h.states[tE].state : null, mV = ex(mE) && M.isNum(h.states[mE].state) ? Number(h.states[mE].state) : null;
      const tLab = st ? `Trinn ${st.lo}–${st.hi} kW` : tS && !/^(unknown|unavailable)$/.test(tS) ? `Trinn ${String(tS).replace(/\s*kW$/i, '').replace('-', '–')} kW` : 'Trinn –';
      const left = st ? st.left : mV, tSub = left != null ? `${nf(left, 1)} kW til neste` : 'Mangler data';
      const tTap = ex(tE) ? tE : ex(mE) ? mE : null;
      const trinn = `<span ${mi(tTap, 'ht trinn', ex(mE) && tTap !== mE ? ` data-ent="${esc(mE)}"` : '')}><span class="l">${tLab}</span><span class="bar"><i style="width:${st ? Math.round(st.pct * 100) : 0}%"></i></span><span class="s">${tSub}</span></span>`;
      // Huset / bilen (usynlige trykkflater over illustrasjonen, samme plassering som bildet)
      const car = this._carTarget();
      // HTML-knapper i foreignObject (følger illustrasjonens skalering; vanlige elementer med .click() for verktøy/tester)
      const hus = `<svg class="hus hhit" viewBox="0 0 400 250" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
          ${ex(eE) ? `<foreignObject x="24" y="72" width="342" height="174"><button class="hz hz-hus" data-hz="hus" data-act="mi" data-id="${esc(eE)}" data-haptic="light" title="Huset · effekt" tabindex="-1"></button></foreignObject>` : ''}
          ${car ? `<foreignObject x="0" y="183" width="128" height="67"><button class="hz" data-hz="bil" data-act="mi" ${car.hash ? `data-hash="${esc(car.hash)}"` : `data-id="${esc(car.id)}"`} data-haptic="light" title="Bilen" tabindex="-1"></button></foreignObject>` : ''}
        </svg>`;
      return `<div class="hero" data-ki-island>
        <span class="hglow"></span>
        ${gear ? `<button class="hgear" data-act="tilpass" title="Tilpass strøm">${ic('mdi:cog', 22)}</button>` : ''}
        <img class="hus" src="${HUS_URL}" alt="">${hus}
        <div class="hnow"><span class="hlab">BRUKER NÅ</span>
          <span ${mi(eE, 'hw', ' title="Effekt nå"')} data-hk="watt"><b class="num" data-watt>${watt}</b><span>W</span></span>
          ${showChip ? `<span ${mi(sE, 'hchip', ' title="Spotpris"')} data-hk="spot"><span class="pdot"><i class="pg"></i><i></i></span>${esc(chip)}</span>` : '<span class="hchip ph" aria-hidden="true"></span>'}</div>
        <div class="htiles">
          <span ${mi(dE, 'ht')} data-hk="dag"><span class="l">I dag</span><span class="v">${V.dag != null ? nf(V.dag, 0) + ' kr' : '–'}</span></span>
          <span ${mi(nE, 'ht')} data-hk="norge"><span class="l">Norgespris</span><span class="v">${V.norge != null ? nf(V.norge, 2) + ' kr' : '–'}</span></span>
          ${trinn.replace('<span class=', '<span data-hk="trinn" class=')}
        </div>
      </div>`;
    }
    // Bilen i toppkortet: valgt entitet (Tilpass → Entiteter) → more-info; ellers Tesla-popupen (#tesla) hvis den finnes;
    // ellers autokonfigurert lader-effekt. Ingen → ingen trykkflate.
    _carTarget() {
      const h = this.hass, o = (this.config && this.config.ent) || {};
      if (o.bil && h && h.states[o.bil]) return { id: o.bil };
      const now = Date.now(); // DOM-søket er dyrt: mellomlagres 30 s
      if (!this._tesla || now - this._tesla.t > 30000) this._tesla = { t: now, v: !!(M.popupExists ? M.popupExists('#tesla') : popupAt('#tesla')) };
      if (this._tesla.v) return { hash: '#tesla' };
      const a = autoEnts(h).bil;
      return a && h.states[a] ? { id: a } : null;
    }
    _secWrap(tab, inner) {
      const c = this.config, h = hidOf(c), dr = this._drag;
      const order = dr && dr.key === 'sec-' + tab ? dr.order : secOrder(c, tab);
      return `<div class="secs">${order.map((k) => {
        if (h[k] || inner[k] == null) return '';
        const lift = dr && dr.key === 'sec-' + tab && dr.id === k ? ' lift' : '';
        return `<div class="sec${lift}" data-rk="sec-${tab}" data-rid="${k}" data-key="sec-${k}">${inner[k]}</div>`;
      }).join('')}</div>`;
    }
    _tabHTML(tab, V) {
      if (tab === 'Forbruk') return this._forbrukHTML(V);
      if (tab === 'Kurser') return this._kurserHTML();
      return this._priserHTML(V);
    }

    /* ---------------- Priser */
    _priserHTML(V) {
      const c = this.config, u = this._ui, P = V.P || {};
      const big = c.cardSize !== 'kompakt';
      const daysLeft = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate() - n.getDate(); })();
      const bv = big ? 'font-size:36px;font-weight:300;line-height:1.05' : 'font-size:40px;font-weight:500;line-height:1';
      const sv = big ? 'font-size:28px;font-weight:300;line-height:1.05' : 'font-size:26px;font-weight:400;line-height:1.1';
      const small = (icon, l, col) => big ? `<span class="ci">${ic(icon, 19, col ? 'color:' + col : '')}</span><span class="cl">${l}</span>` : `<span class="cs">${ic(icon, 15, col ? 'color:' + col : '')}${l}</span>`;
      const kort = `<div class="k2 fade">
        <button class="bill" data-act="page" data-page="stromregning" data-bp="Måned"><span class="bi" style="width:${big ? 48 : 44}px;height:${big ? 48 : 44}px">${ic('mdi:receipt-text-outline', big ? 24 : 22)}</span>
          <span class="bl">Regning ${MND[new Date().getMonth()]}</span><span class="bv"><b class="num" style="${bv}">${V.maned != null ? nf(V.maned, 0) : '–'}</b><small>kr</small></span>
          <span class="bs">${V.manedEst ? 'Estimat' : 'Hittil'} · ${daysLeft} dager igjen</span></button>
        <div class="kcol">
          <button class="kc" data-act="page" data-page="stromregning" data-bp="Dag">${small('mdi:calendar-today', 'Kostnad i dag')}<span class="cv"><b class="num" style="${sv}">${V.dag != null ? nf(V.dag, 0) : '–'}</b><small>kr</small></span></button>
          <button class="kc" data-act="page" data-page="norgespris">${small('mdi:piggy-bank-outline', 'Spart med Norgespris', GREEN)}<span class="cv"><b class="num" style="${sv};color:${GREEN}">${V.spart != null ? nf(V.spart, 0) : '–'}</b><small>kr i dag</small></span></button>
        </div></div>`;
      // Hva koster det nå
      const ep = exPriceOf(c);
      let pv = null;
      if (ep === 'norge') pv = V.norge;
      else if (ep === 'total') { try { const PT = M.powerPrice(this.hass, M.powerPriceCfg(null, { spot_entity: this.ent('spot') || '', mode: 'total', unit: 'kr' })); pv = PT.now; } catch (e) { pv = null; } }
      else pv = V.spot;
      const pl = ep === 'total' ? 'totalpris' : (PRS.find((x) => x[0] === ep) || [])[1].toLowerCase();
      const exOn = exShowOf(c), list = EXALL.filter((x) => exOn.includes(x[0]));
      const fx = (k) => (pv == null ? '–' : nf(k * pv, k * pv >= 10 ? 1 : 2));
      const eks = `<button class="exr" data-act="ex">${ic('mdi:calculator', 20, 'color:' + T1B)}<span class="t">Hva koster det nå</span><span class="h">ved ${pv != null ? nf(pv, 2) : '–'} kr/kWh · ${esc(pl)}</span>${ic('mdi:chevron-down', 22, '')}</button>
        ${u.ex ? `<div class="exl">${list.length ? list.map(([id, icon, l, kwh]) => `<div class="exi"><span class="ico">${ic(icon, 20)}</span><span class="n"><b>${esc(l)}</b><span>~${nf(kwh, kwh < 1 ? 2 : 1)} kWh</span></span><span class="v">${fx(kwh)} <small>kr</small></span></div>`).join('') : `<div class="exi"><span class="n"><span>Ingen eksempler valgt – velg i Tilpass → Visning</span></span></div>`}</div>` : ''}`;
      // graf
      const tom = u.pday === 1;
      const hourly = (tom ? P.spotTomorrow : P.spotToday) || Array(24).fill(null);
      const nowH = new Date().getHours();
      const has = hourly.some((v) => v != null);
      let si = u.selH != null ? u.selH : tom ? null : nowH;
      if (si != null && hourly[si] == null) si = null;
      const avg = avgOf(hourly), sv2 = si == null ? avg : hourly[si];
      const lv = levelOf(sv2, avgOf(hourly), null);
      const selLabel = !has ? (tom ? 'Spotpris i morgen' : 'Spotpris i dag') : si == null ? (tom ? 'Snitt i morgen' : 'Snitt i dag') : `${si === nowH && !tom ? 'Nå · ' : tom ? 'I morgen · ' : ''}kl. ${M.pad(si)}–${M.pad((si + 1) % 24)}`;
      const graf = `<div class="gc">
        <div class="gh"><span style="display:flex;flex-direction:column;gap:4px"><span class="sl">${selLabel}</span><span class="sv"><b>${sv2 != null ? nf(sv2, 2) : '–'}</b><small>kr/kWh</small></span>${lv != null ? `<span class="lchip" style="background:${LVL[lv][1]}">${LVL[lv][0]}</span>` : ''}</span>
          <span class="seg" data-glass-drag="x">${[['I dag', 0], ['I morgen', 1]].map(([l, k]) => `<button class="${(u.pday || 0) === k ? 'on' : ''}" data-act="pday" data-v="${k}" data-haptic="selection">${l}</button>`).join('')}</span></div>
        ${this._chartHTML(hourly, has, tom, si, nowH, V.norge)}
        <div class="lg"><span><span style="width:14px;height:2px;background:rgb(242 133 201)"></span>Spotpris (kr/kWh)</span>${V.norge != null ? '<span><span style="width:14px;border-top:2px dashed rgb(115 165 230)"></span>Norgespris</span>' : ''}</div>
      </div>`;
      // lavest/høyest/snitt
      const hv = hourly.filter((v) => v != null), mn = hv.length ? Math.min(...hv) : null, mx = hv.length ? Math.max(...hv) : null;
      const hOf = (v) => M.pad(hourly.indexOf(v));
      const minis = `<div class="minis">${[['mdi:arrow-down', 'Lavest', mn, mn != null ? `kl. ${hOf(mn)}` : '–', GREEN_F], ['mdi:arrow-up', 'Høyest', mx, mx != null ? `kl. ${hOf(mx)}` : '–', RED_F], ['mdi:function-variant', 'Snitt', avg, 'kr/kWh', T2]]
        .map(([icon, l, v, s, col]) => `<div class="mi"><span class="l">${ic(icon, 15, 'color:' + col)}${l}</span><span class="v">${v != null ? nf(v, 2) : '–'}</span><span class="s">${s}</span></div>`).join('')}</div>`;
      // inkludert i prisen
      const TG = togglesOf(this.hass, c);
      const bryt = TG.length ? `<div class="sh2"><b>Inkludert i prisen</b><button class="ib" data-act="page" data-page="innstillinger" title="Innstillinger">${ic('mdi:cog', 18)}</button></div>
        <div class="tg2">${TG.map((t) => { const s = this.s(t.id), on = s && s.state === 'on'; return `<button class="tg${on ? ' on' : ''}" data-act="tog" data-id="${esc(t.id)}" data-ent="${esc(t.id)}" data-tg="${t.k}" data-haptic="selection" title="Hold for detaljer" aria-pressed="${!!on}"><span class="th"></span><span class="ti">${ic(t.icon, 22)}</span><span class="tn"><b>${esc(t.l)}</b><span>${on ? 'På' : 'Av'}</span></span></button>`; }).join('')}</div>` : null;
      return this._secWrap('Priser', { p_kort: kort, p_eks: eks, p_graf: graf, p_minis: minis, p_bryt: bryt });
    }
    _chartHTML(hourly, has, tom, si, nowH, norge) {
      const key = `pg-${tom ? 1 : 0}-${has ? 1 : 0}-${new Date().toDateString()}`;
      if (!has) return `<div class="pc" data-key="${key}"><div class="none">${tom ? 'Prisene for i morgen kommer ca. kl. 13:00' : 'Ingen timepriser – velg pris-entitet i Tilpass → Entiteter'}</div></div>`;
      const vals = hourly.filter((v) => v != null), ref = norge != null ? [norge] : [];
      const lo0 = Math.min(...vals, ...ref), hi0 = Math.max(...vals, ...ref);
      const STEPV = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10];
      let step = STEPV.find((s) => (hi0 - lo0) / s <= 5) || 10;
      const gLo = Math.floor((lo0 - step / 2) / step) * step, gHi = Math.ceil((hi0 + step / 4) / step) * step;
      const nT = Math.max(1, Math.round((gHi - gLo) / step)), gy = (v) => 100 - ((v - gLo) / (gHi - gLo)) * 100;
      const grid = Array.from({ length: nT + 1 }, (_, i) => { const v = gLo + i * step, t = 100 - (i / nT) * 100; return `<span class="gl${i ? '' : ' z'}" style="top:${t}%"></span><span class="yl" style="top:${t}%">${nf(v, step < 0.1 ? 2 : step < 1 ? 2 : 0)}</span>`; }).join('');
      let d = '';
      hourly.forEach((v, i) => { if (v == null) return; const y = gy(v).toFixed(2); d += `${d ? 'L' : 'M'}${i * 10},${y} L${i * 10 + 10},${y} `; });
      const first = hourly.findIndex((v) => v != null), last = hourly.length - 1 - [...hourly].reverse().findIndex((v) => v != null);
      const area = `${d}L${last * 10 + 10},100 L${first * 10},100 Z`;
      const anim = this.anim;
      const nrm = norge != null ? `<path d="M0,${gy(norge).toFixed(2)} L240,${gy(norge).toFixed(2)}" fill="none" stroke="rgb(115 165 230)" stroke-width="1.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"></path>` : '';
      const nowL = (nowH + 0.5) / 24 * 100;
      return `<div class="pc" data-key="${key}">${grid}
        ${si != null ? `<span class="band" style="left:${(si / 24 * 100).toFixed(3)}%;width:${(100 / 24).toFixed(3)}%"></span>` : ''}
        <svg viewBox="0 0 240 100" preserveAspectRatio="none"><defs><linearGradient id="spa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(242,133,201)" stop-opacity=".35"></stop><stop offset="1" stop-color="rgb(242,133,201)" stop-opacity="0"></stop></linearGradient></defs>
          <path d="${area}" fill="url(#spa)" style="${anim ? 'animation:fade .9s ease' : ''}"></path>${nrm}
          <path d="${d}" pathLength="1" fill="none" stroke="rgb(242 133 201)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" style="${anim ? 'stroke-dasharray:1;stroke-dashoffset:0;animation:draw .9s cubic-bezier(.4,0,.2,1)' : ''}"></path></svg>
        ${!tom ? `<span class="nl" style="left:${nowL.toFixed(3)}%"></span><span class="nt" style="left:${nowL.toFixed(3)}%">Nå</span>` : ''}
        ${si != null ? `<span class="sd" style="left:${((si + 0.5) / 24 * 100).toFixed(3)}%;top:${gy(hourly[si]).toFixed(2)}%"></span>` : ''}
        <div class="scrub" data-scrub>${hourly.map((v, i) => `<span data-h="${i}" title="${M.pad(i)}:00 · ${v != null ? nf(v, 2) + ' kr' : '–'}"></span>`).join('')}</div>
        ${[0, 3, 6, 9, 12, 15, 18, 21].map((hh) => `<span class="xl" style="left:${(hh / 24 * 100).toFixed(3)}%">${M.pad(hh)}</span>`).join('')}</div>`;
    }

    /* ---------------- Forbruk */
    _ucVal(k, V) {
      const kwh = (v) => (v == null ? '–' : nf(v, v >= 100 ? 0 : 1));
      switch (k) {
        case 'now': return [V.watt != null ? Math.round(V.watt).toLocaleString('nb-NO') : '–', 'W'];
        case 'day': return [kwh(V.dayKwh), 'kWh'];
        case 'month': return [kwh(V.monthKwh), 'kWh'];
        case 'year': return [kwh(V.yearKwh), 'kWh'];
        case 'cost': return [V.dag != null ? nf(V.dag, 0) : '–', 'kr'];
        case 'peak': return [V.peak != null ? nf(V.peak, 2) : '–', 'kW'];
        case 'step': return [V.step ? `${V.step.lo}–${V.step.hi}` : '–', 'kW'];
        case 'ev': return [V.ev != null ? nf(V.ev, 2) : '–', 'kWh'];
        default: return ['–', ''];
      }
    }
    _forbrukHTML(V) {
      const c = this.config, u = this._ui, dr = this._drag;
      const uc = dr && dr.key === 'useCards' ? dr.order : ucOf(c);
      const kort = `<div class="uc2">${uc.map((k) => { const [icon, l] = UC[k], [v, un] = this._ucVal(k, V), lift = dr && dr.key === 'useCards' && dr.id === k ? ' lift' : '';
        return `<div class="uc${lift}" data-rk="useCards" data-rid="${k}" data-key="uc-${k}"><span class="ui">${ic(icon, 24)}</span><span class="ul">${esc(l)}</span><span class="uv"><b>${v}</b><small>${un}</small></span></div>`; }).join('')}</div>`;
      const n = new Date();
      const rowsDef = { dag: ['I dag:', V.dayKwh, V.trend.day], maned: ['Måned:', V.monthKwh, V.trend.month], ar: ['År:', V.yearKwh, V.trend.year] };
      const ro = dr && dr.key === 'useStats' ? dr.order : ordIds(((c.ord || {}).useStats), Object.keys(rowsDef));
      const stat = `<div class="fh">${ic('mdi:meter-electric', 20)}<b>Forbruk</b><span>${DAGER[n.getDay()]} ${n.getDate()}. ${MND[n.getMonth()]}</span></div>
        <div class="fs">${ro.map((k) => { const [l, v, tr] = rowsDef[k], lift = dr && dr.key === 'useStats' && dr.id === k ? ' lift' : '';
          const ar = tr == null || tr === 0 ? '' : ic(tr > 0 ? 'mdi:arrow-up' : 'mdi:arrow-down', 18, `color:${tr > 0 ? 'var(--ki-red-text, rgb(240 120 100))' : 'var(--ki-green-text, rgb(110 210 150))'}`);
          return `<div class="fr${lift}" data-rk="useStats" data-rid="${k}" data-key="fr-${k}"><span class="l">${l}</span><span class="v">${v == null ? '–' : nf(v, v >= 100 ? 0 : 1)}</span><span class="u">kWh</span><span class="a">${ar}</span></div>`; }).join('')}</div>`;
      // dag-graf
      const off = u.fday || 0, D = this._st.day.get(off), d = dayStart(off);
      const R = this._R();
      const evN = R && R.ev ? M.name(this.hass, R.ev) : null;
      let layers = [];
      if (D) {
        const base = D.imp.map((v, i) => (v == null ? null : Math.max(0, v - (D.ev[i] || 0))));
        layers.push({ l: R && R.grid_in[0] ? M.name(this.hass, R.grid_in[0]) : 'Strømnett', vals: base, bg: 'rgba(170,180,205,.85)', bd: '1px solid rgba(220,225,240,.6)', dot: '#9aa3b8' });
        if (anyV(D.ev) && sum(D.ev) > 0) layers.push({ l: evN || 'Elbillader', vals: D.ev, bg: 'rgba(200,200,200,.6)', bd: '1px solid rgba(230,230,230,.6)', dot: '#bdbdbd' });
        if (anyV(D.sol) && sum(D.sol) > 0) layers.push({ l: 'Sol', vals: D.sol, bg: 'rgba(242,210,111,.75)', bd: '1px solid rgba(242,210,111,.9)', dot: '#f2d26f' });
      }
      const tot = Array.from({ length: 24 }, (_, i) => layers.reduce((s, L) => s + (L.vals[i] || 0), 0));
      const mx = Math.max(0, ...tot), stepK = mx > 4 ? Math.ceil(mx / 4) : 1, ticks = 4, top = stepK * ticks;
      const bkey = `fb-${off}-${D ? D.t : 0}`;
      const anim = this.anim;
      const bars = !D ? `<div class="none">${R && !R.grid_in.length ? 'Energi-oppsettet mangler strømnett' : R ? 'Henter …' : 'Energi-oppsettet er ikke satt opp i Home Assistant'}</div>`
        : `${Array.from({ length: ticks + 1 }, (_, i) => `<span class="gl${i ? '' : ' z'}" style="top:${100 - (i / ticks) * 100}%"></span><span class="yl" style="top:${100 - (i / ticks) * 100}%">${nf(i * stepK, stepK < 1 ? 1 : 0)}</span>`).join('')}
          <div class="cols">${tot.map((_, bi) => `<span class="col">${[...layers].reverse().map((L, li) => { const v = L.vals[bi] || 0, ri = layers.length - 1 - li; return v > 0 ? `<i style="height:${(v / top * 100).toFixed(2)}%;background:${L.bg};border:${L.bd};${ri ? 'border-bottom:none;' : ''}border-radius:${ri === layers.length - 1 ? '2px 2px 0 0' : ri ? '0' : layers.slice(1).some((x) => (x.vals[bi] || 0) > 0) ? '0 0 2px 2px' : '2px 2px 0 0'};${anim ? `animation:grow .55s cubic-bezier(.2,.8,.2,1) ${bi * 18 + ri * 120}ms both` : ''}"></i>` : ''; }).join('')}</span>`).join('')}</div>`;
      const xs = [[0, `${d.getDate()}. ${MNK[d.getMonth()]}`], [4, '4:00'], [8, '8:00'], [12, '12:00'], [16, '16:00'], [20, '20:00']].map(([hh, l]) => `<span class="xl" style="left:${((hh + 0.5) / 24 * 100).toFixed(2)}%;font-weight:${hh ? 400 : 600}">${l}</span>`).join('');
      const legend = layers.map((L) => `<span>${ic('mdi:check-circle', 16, 'color:' + L.dot)}${esc(L.l)}</span>`).join('') + (R && R.grid_out.length ? `<span>${ic('mdi:check-circle', 16, 'color:#8a7fb0')}${esc(M.name(this.hass, R.grid_out[0]))}</span>` : '');
      const graf = `<div class="dh">${ic('mdi:calendar-today', 22)}<span class="dl">${d.getDate()}. ${MNK[d.getMonth()]}</span>
          <button class="dnow" data-act="fday" data-v="0" data-haptic="selection">Nå</button>
          <button class="r40" data-act="fday" data-v="${off - 1}" data-haptic="selection" title="Forrige dag">${ic('mdi:chevron-left', 22)}</button>
          <button class="r40" data-act="fday" data-v="${off + 1}" data-haptic="selection" title="Neste dag" ${off < 0 ? '' : 'disabled'}>${ic('mdi:chevron-right', 22)}</button></div>
        <div class="bc"><div class="ba" data-key="${bkey}"><span class="ku">kWh</span>${bars}${xs}</div>${layers.length ? `<div class="leg">${legend}</div>` : ''}</div>`;
      // kilder
      let kilder = null;
      if (D) {
        const costT = D.cost ? sum(D.cost) : null, impT = sum(D.imp);
        const share = (kwh) => (costT != null && impT > 0 ? (costT * kwh) / impT : null);
        const rows = [];
        D.per.forEach((p, i) => { const k = sum(p.vals); rows.push([M.name(this.hass, p.id), `${nf(k, 2)} kWh`, share(k) != null ? `${nf(share(k), 2)} kr` : '–', i ? '#c8c8c8' : '#9aa3b8', false]); });
        if (R && R.grid_out.length) { const k = sum(D.exp); rows.push([M.name(this.hass, R.grid_out[0]), `−${nf(k, k ? 2 : 0)} kWh`, '–', '#8a7fb0', false]); }
        if (anyV(D.ev)) { const k = sum(D.ev); rows.push([evN || 'Elbillader', `${nf(k, 2)} kWh`, share(k) != null ? `${nf(share(k), 2)} kr` : '–', '#bdbdbd', false]); }
        rows.push(['Strømnett totalt', `${nf(impT, 1)} kWh`, costT != null ? `${nf(costT, 2)} kr` : '–', null, true]);
        if (R && R.water.length && anyV(D.water)) { const L = sum(D.water); rows.push([M.name(this.hass, R.water[0]), `${nf(L, 0)} L`, D.wcost ? `${nf(sum(D.wcost), 2)} kr` : '–', '#3f9aa6', false]); }
        kilder = `<div class="src"><div class="srh"><span>Kilde</span><span style="text-align:right">Energi</span><span style="text-align:right">Kostnad</span></div>${rows.map(([l, e, k, col, t]) => `<div class="srr${t ? ' tot' : ''}"><span class="d" style="background:${col || 'transparent'}"></span><span class="n">${esc(l)}</span><span class="e">${e}</span><span class="e">${k}</span></div>`).join('')}</div>`; // ki-hex-ok: designets kildefarger
      }
      return this._secWrap('Forbruk', { f_kort: kort, f_stat: stat, f_graf: graf, f_kilder: kilder });
    }

    /* ---------------- Kurser (modul B) */
    _kurserHTML() {
      const K = M.stromKurser;
      if (!K || typeof K.html !== 'function') return `<div class="empty2" data-sk-wait>${ic('mdi:timer-sand', 20)}<span>Kurser lastes …</span></div>`;
      let h = ''; try { h = K.html(this); } catch (e) { console.error('msh-strom-card', 'stromKurser.html', e); h = `<div class="empty2">${ic('mdi:alert-circle-outline', 20)}<span>Kurser feilet: ${esc(e.message || e)}</span></div>`; }
      return `<div class="skhost" data-skhost>${h}</div>`;
    }
    /* ---------------- undersider (modul C) */
    _pageHTML(page) {
      const [title, icon] = PAGES[page];
      // C tegner selv overskriften (tilbake-pil/lukk + tittel + ikon, data-ss-act="back" → host.go(null))
      const head = M.stromSider ? '' : `<div class="ph"><button class="back" data-act="back" title="Tilbake">${ic('mdi:arrow-left', 22)}</button><span class="pt">${title}</span><span class="pi">${ic(icon, 22)}</span></div>`;
      const S = M.stromSider;
      let body;
      if (!S || typeof S.html !== 'function') body = `<div class="empty2" data-ss-wait>${ic('mdi:timer-sand', 20)}<span>${title} lastes …</span></div>`;
      else { try { body = S.html(this, page); } catch (e) { console.error('msh-strom-card', 'stromSider.html', e); body = `<div class="empty2">${ic('mdi:alert-circle-outline', 20)}<span>${title} feilet: ${esc(e.message || e)}</span></div>`; } }
      return `${head}<div class="sshost" data-sshost="${page}" style="display:flex;flex-direction:column;gap:12px">${body}</div>`;
    }

    get styles() {
      const B = M.stromKurser && M.stromKurser.css ? M.stromKurser.css : '', Cs = M.stromSider && M.stromSider.css ? M.stromSider.css : '';
      return (M.segment ? M.segment.css : '') + CSS + B + Cs;
    }
    afterRender() {
      const R = this.shadowRoot;
      // «Inkludert i prisen»-pillene (touch-action pan-y, hold → more-info): gestene skal ikke nå Bubble-popupen (fallgruve 2).
      // Boble-fasen – basekortets hold-lytter (capture på shadowRoot) får dem fortsatt.
      R.querySelectorAll('.tg').forEach((el) => { if (el.__tgStop) return; el.__tgStop = true; const st = (e) => e.stopPropagation(); el.addEventListener('pointerdown', st); el.addEventListener('touchstart', st, { passive: true }); el.addEventListener('touchmove', st, { passive: true }); });
      const row = R.querySelector('[data-tabbar]');
      if (row && M.tabRow) {
        M.tabRow(this, row, { active: () => { const V = visTabs(this.config); return V.includes(this._ui.tab) ? this._ui.tab : V[0]; }, order: () => orderOf(this.config), save: (full) => this.setCfg({ order: full }) });
      }
      if (M.glassDrag) R.querySelectorAll('.seg[data-glass-drag]').forEach((s) => M.glassDrag(s, { axis: 'x', touchAction: 'pan-y' }));
      this._scrubInit(R.querySelector('[data-scrub]'));
      const sk = R.querySelector('[data-skhost]');
      if (sk && M.stromKurser && M.stromKurser.bind) { try { M.stromKurser.bind(this, sk); } catch (e) { console.error('msh-strom-card', 'stromKurser.bind', e); } }
      const ss = R.querySelector('[data-sshost]');
      if (ss && M.stromSider && M.stromSider.bind) { try { M.stromSider.bind(this, ss, ss.dataset.sshost); } catch (e) { console.error('msh-strom-card', 'stromSider.bind', e); } }
      // modulene lastes etter kortet (bundel-rekkefølge / egen ressurs) → tegn på nytt når de finnes
      if ((R.querySelector('[data-sk-wait]') || R.querySelector('[data-ss-wait]')) && !this._waitMods) {
        this._waitMods = setTimeout(() => { this._waitMods = null; this.update(); }, 500);
      }
      if (this._tp && this._tp.ov && !this._tp.ov.closed) this._tpRender();
    }

    /* ---------------- handlinger */
    onAction(name, el, e) {
      const d = el.dataset;
      if (name === 'tab') { if (this._ui.tab !== d.v) { this.setUI({ tab: d.v, selH: null }); if (d.v === 'Forbruk') this._load(); } return; }
      if (name === 'tilpass') return this.customize();
      if (name === 'page') { if (d.bp) { this._ui.billPer = d.bp; this._ui.ssBp = d.bp; } return this.go(d.page); }
      if (name === 'back') return this.go(null);
      if (name === 'ex') return this.setUI({ ex: !this._ui.ex });
      if (name === 'pday') return this.setUI({ pday: Number(d.v) || 0, selH: null });
      if (name === 'fday') { const v = Math.min(0, Number(d.v) || 0); this.setUI({ fday: v }); return this._load(); }
      if (name === 'tog') return M.toggle(this.hass, d.id);
      if (name === 'mi') { // Fiks 47 T: toppkortets deler → more-info (eller Tesla-popupen)
        if (e && e.stopPropagation) e.stopPropagation();
        if (d.hash) return M.openPopup(d.hash);
        return M.moreInfo(this, d.id);
      }
      return super.onAction(name, el, e);
    }
    customize() { return this._openTilpass(); }

    /* ---------------- scrub i prisgrafen (touch-action none + stopPropagation, fallgruve 2) */
    _scrubInit(el) {
      if (!el || el.__sc) return;
      el.__sc = true;
      el.style.touchAction = 'none'; el.__mshTA = 'none';
      const hourAt = (x) => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(23, Math.floor(((x - r.left) / Math.max(1, r.width)) * 24))); };
      let on = null;
      const set = (x) => { const h = hourAt(x); if (h !== this._ui.selH) { M.haptic('selection'); this.setUI({ selH: h }); } };
      el.addEventListener('pointerdown', (e) => { if (e.button) return; e.stopPropagation(); on = e.pointerId; try { el.setPointerCapture(e.pointerId); } catch (x) { /* */ } set(e.clientX); });
      el.addEventListener('pointermove', (e) => { if (on !== e.pointerId) return; e.stopPropagation(); set(e.clientX); });
      const end = (e) => { if (on !== e.pointerId) return; on = null; };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
      ['touchstart', 'touchmove'].forEach((t) => el.addEventListener(t, (e) => e.stopPropagation(), { passive: true }));
    }

    /* ---------------- hold 400 ms + dra: seksjoner, Forbruk-kort og -rader (designets hold()) */
    _holdInit() {
      const R = this.shadowRoot;
      let H = null;
      const ids = (key) => {
        const c = this.config;
        if (key === 'useCards') return ucOf(c).slice();
        if (key === 'useStats') return ordIds((c.ord || {}).useStats, ['dag', 'maned', 'ar']);
        const tab = key.replace(/^sec-/, '');
        return SECS[tab] ? secOrder(c, tab) : [];
      };
      const axisOf = (key) => (key === 'useCards' ? 'x' : 'y');
      const cleanup = () => { if (!H) return; clearTimeout(H.t); window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); H = null; };
      const mv = (ev) => {
        if (!H || ev.pointerId !== H.pid) return;
        if (!H.on) { if (Math.hypot(ev.clientX - H.x, ev.clientY - H.y) > 8) cleanup(); return; }
        ev.preventDefault(); ev.stopPropagation();
        const ax = axisOf(H.key), p = ax === 'x' ? ev.clientX : ev.clientY;
        const hit = [...R.querySelectorAll(`[data-rk="${H.key}"]`)].find((n) => { const r = n.getBoundingClientRect(); return r.width && (ax === 'x' ? p >= r.left && p <= r.right : p >= r.top && p <= r.bottom); });
        const rid = hit && hit.dataset.rid;
        if (rid && rid !== H.id) { const o = this._drag.order.filter((x) => x !== H.id), ti = this._drag.order.indexOf(rid); o.splice(ti, 0, H.id); this._drag = { ...this._drag, order: o }; M.haptic('selection'); this._schedule(true); }
      };
      const up = () => {
        const was = H && H.on, key = H && H.key;
        cleanup();
        if (!was) return;
        const kill = (c) => { c.stopPropagation(); c.preventDefault(); };
        window.addEventListener('click', kill, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', kill, true), 350);
        setTimeout(() => { window.__tabReorder = false; }, 50);
        const o = this._drag.order, before = ids(key);
        this._drag = null;
        M.haptic('light');
        if (JSON.stringify(o) !== JSON.stringify(before)) {
          if (key === 'useCards') this.setCfg({ useCards: o });
          else this.setCfg({ ord: { ...(this.config.ord || {}), [key]: o } });
        } else this._schedule(true);
      };
      R.addEventListener('pointerdown', (e) => {
        if (e.button || H || this._drag) return;
        const path = e.composedPath ? e.composedPath() : [];
        let el = null;
        for (const n of path) { if (n === R) break; if (n.matches && n.matches('input,textarea,select,[data-scrub],[data-tabbar],[data-glass-drag],[data-skhost],[data-sshost],[data-ent],[data-tg]')) return; /* B/C har egen hold + dra */ if (!el && n.dataset && n.dataset.rk && n.getRootNode() === R) el = n; }
        if (!el) return;
        H = { key: el.dataset.rk, id: el.dataset.rid, pid: e.pointerId, x: e.clientX, y: e.clientY, on: false, el };
        H.t = setTimeout(() => {
          if (!H) return;
          H.on = true; window.__tabReorder = true;
          this._drag = { key: H.key, id: H.id, order: ids(H.key) };
          M.haptic('medium');
          try { H.el.setPointerCapture(H.pid); } catch (x) { /* */ }
          this._schedule(true);
        }, 400);
        window.addEventListener('pointermove', mv, { capture: true, passive: false });
        window.addEventListener('pointerup', up, true);
        window.addEventListener('pointercancel', up, true);
      });
      // under dra: ingen scroll og ingen sveip-for-å-lukke i Bubble (fallgruve 2)
      R.addEventListener('touchmove', (e) => { if (this._drag) { if (e.cancelable) e.preventDefault(); e.stopPropagation(); } }, { passive: false });
      R.addEventListener('touchstart', (e) => { if (this._drag) e.stopPropagation(); }, { passive: true });
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this._drag) { cleanup(); this._drag = null; window.__tabReorder = false; this._schedule(true); } });
    }

    /* ---------------- «Tilpass strøm» (MSH.overlay tilpass, full høyde, håndtaket bytter til 58 %) */
    _openTilpass(tab) {
      if (this._tp && this._tp.ov && !this._tp.ov.closed) return;
      const ov = M.overlay({ html: '', css: TP_CSS + ((M.stromKurser && M.stromKurser.css) || ''), maxWidth: 440, tall: true, tilpass: true, guard: 350, onClose: () => { this._tp = null; } });
      this._tp = { ov, st: { tab: tab || 'faner', half: false } };
      const sh = ov.root.querySelector('.sh'), gz = ov.root.querySelector('.gz');
      if (gz) {
        let y0 = null;
        gz.addEventListener('pointerdown', (e) => { y0 = e.clientY; });
        gz.addEventListener('click', (e) => {
          if (y0 != null && Math.abs(e.clientY - y0) > 6) return;
          M.haptic('selection');
          const st = this._tp && this._tp.st; if (!st) return;
          st.half = !st.half;
          sh.style.transition = 'transform 280ms cubic-bezier(.2,.8,.2,1), top .3s cubic-bezier(.2,.9,.3,1), height .3s cubic-bezier(.2,.9,.3,1)';
          sh.style.top = st.half ? '42%' : ''; sh.style.height = st.half ? '58%' : '';
        });
      }
      this._tpRender();
    }
    _tpCtx() {
      const self = this;
      return { host: this, hass: this.hass, get cfg() { return self.config; }, st: this._tp.st, set: (p) => this.setCfg(p), rerender: () => this._tpRender(), close: () => this._tp && this._tp.ov.close() };
    }
    _tpRender() {
      const tp = this._tp;
      if (!tp || !tp.ov || tp.ov.closed) return;
      const ctx = this._tpCtx();
      M.morph(tp.ov.body, TP.html(ctx, true));
      TP.bind(tp.ov.body, ctx, true);
    }
  }
  const TRANSIENT = new Set(['page', 'selH', 'fday', 'billPer']);

  /* ================================================================ Tilpass strøm (arket og GUI-editoren) */
  const TP_CSS = `
    @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    .tp{display:flex;flex-direction:column;gap:8px;color:var(--ki-text, #fafafa);font-family:inherit}
    .tph{display:flex;align-items:center;gap:8px;padding:10px 4px 14px}
    .tph .tt{flex:1;font-size:24px;font-weight:600;letter-spacing:-0.01em}
    .tph .rs{height:40px;padding:0 16px;border-radius:20px;background:var(--ki-surface, #3a3a3a);font-size:14px;font-weight:500;transition:transform .15s}
    .tph .dn{${M.DONE_PILL || ''}}
    .tph button:active{transform:scale(.96)}
    .tpt{display:flex;gap:2px;padding:4px;border-radius:24px;background:var(--ki-surface, #3a3a3a);box-shadow:inset 0 0 0 1px ${WA(0.05)};margin-bottom:4px}
    .tpt button{flex:0 0 52px;height:44px;padding:0;border-radius:20px;display:flex;align-items:center;justify-content:center;gap:8px;font-size:14px;font-weight:600;background:transparent;color:var(--ki-text-2, #afafaf);transition:flex .25s,background .25s;white-space:nowrap}
    .tpt button.on{flex:1 0 auto;padding:0 16px 0 12px;background:${ACC};color:${INK2}}
    .tpb{display:grid;grid-template-columns:minmax(0,1fr);grid-auto-rows:max-content;align-content:start;gap:8px;padding-bottom:48px}
    .hint{font-size:13px;color:var(--ki-text-mid, #979797);padding:2px 8px 4px;line-height:1.4}
    .lab{font-size:13px;font-weight:500;color:var(--ki-text-mid, #979797);padding:10px 8px 2px}
    .info{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:24px;background:rgb(115 185 242 / 0.1);box-shadow:inset 0 0 0 1px rgb(115 185 242 / 0.22)}
    .info span{font-size:13px;line-height:1.45;color:var(--ki-text-1, #c7c7c7)}
    .trw{display:flex;align-items:center;gap:8px;min-height:60px;padding:0 8px 0 0;border-radius:24px;background:var(--ki-surface, #3a3a3a);transition:background .2s,box-shadow .2s,transform .2s}
    .trw.hd{opacity:.55}.trw.dg{background:var(--ki-surface-2, #4a4a4a);box-shadow:0 10px 24px ${KA(0.4)};transform:scale(1.02)}
    .drg{width:40px;height:52px;flex:none;display:grid;place-items:center;color:var(--ki-text-3, #7f7f7f);touch-action:none;cursor:grab}
    .trw .tl{flex:1;align-self:stretch;display:flex;align-items:center;gap:8px;font-size:15px;font-weight:500;cursor:pointer;min-width:0}
    .trw .tl small{font-size:12px;font-weight:400;color:var(--ki-text-3, #7f7f7f)}
    .stp{height:20px;padding:0 8px;border-radius:10px;background:rgba(242,133,201,.16);color:var(--ki-pink-text, rgb(242 133 201));font-size:10px;font-weight:600;display:flex;align-items:center}
    .chv{width:40px;height:44px;flex:none;display:grid;place-items:center;color:var(--ki-text-mid, #979797)}.chv ha-icon{transition:transform .25s}.chv.up ha-icon{transform:rotate(180deg)}
    .eye{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;color:var(--ki-text-3, #7f7f7f)}.eye.on{color:var(--ki-text-1, #e1e1e1)}.eye.s{width:40px;height:40px}
    .subs{display:flex;flex-direction:column;gap:6px;padding:0 0 6px 24px;animation:fade .2s ease}
    .sbr{display:flex;align-items:center;gap:8px;min-height:52px;padding:0 6px 0 0;border-radius:20px;background:var(--ki-surface-3, #333)}.sbr.hd{opacity:.55}
    .sbr .si{width:40px;text-align:center;flex:none;color:var(--ki-text-3, #7f7f7f);display:flex;justify-content:center}.sbr .sl{flex:1;min-width:0;font-size:14px;font-weight:500}
    .er{border-radius:24px;background:var(--ki-surface, #3a3a3a);overflow:hidden;transition:background .2s}.er.op{background:var(--ki-surface-2, #404040)}
    .erb{display:flex;align-items:center;gap:12px;width:100%;min-height:60px;padding:8px 12px 8px 8px;text-align:left}
    .eri{width:44px;height:44px;border-radius:22px;flex:none;display:grid;place-items:center;background:var(--ki-surface-2, #4a4a4a)}
    .ern{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.ern b{font-size:15px;font-weight:500}.ern span{font-size:12px;color:var(--ki-text-mid, #979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .bdg{height:22px;padding:0 8px;border-radius:11px;flex:none;display:flex;align-items:center;font-size:11px;font-weight:600;background:var(--ki-surface-2, #4a4a4a);color:var(--ki-text-2, #afafaf)}.bdg.c{background:rgba(242,133,201,.16);color:var(--ki-pink-text, rgb(242 133 201))}
    .erx{display:flex;flex-direction:column;gap:8px;padding:0 14px 14px;animation:fade .2s ease}
    .srch{display:flex;align-items:center;gap:10px;height:48px;padding:0 16px;border-radius:24px;background:var(--ki-surface-3, #4a4a4a)}
    .srch input{flex:1;min-width:0;height:100%;border:0;outline:none;background:none;color:var(--ki-text, #fafafa);font:inherit;font-size:15px}
    .sug{display:flex;flex-direction:column;gap:2px}.sug button{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:8px 12px;border-radius:14px;text-align:left}.sug button:hover{background:${WA(0.06)}}
    .sug b{font-size:13px;font-weight:500}.sug span{font-size:11px;color:var(--ki-text-mid, #979797)}
    .auto{height:44px;border-radius:22px;background:var(--ki-surface, #3a3a3a);font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:6px}
    .sg{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:2px;padding:4px;border-radius:24px;background:var(--ki-surface, #3a3a3a)}
    .sg.in{padding:3px;border-radius:22px;background:var(--ki-surface-3, #2a2a2a)}
    .sg button{height:44px;border-radius:20px;font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:6px;color:var(--ki-text-2, #afafaf);transition:background .25s;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
    .sg.in button{font-size:13px}
    .sg button.on{background:${ACC};color:${INK2}}
    .box{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:24px;background:var(--ki-surface, #3a3a3a)}
    .box .bl{font-size:12px;color:var(--ki-text-mid, #979797);padding-left:4px}
    .entc{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;background:var(--ki-surface-3, #2f2f2f)}
    .entc b{font-size:13px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}.entc span{font-size:11px;color:var(--ki-text-mid, #979797)}
    .swr{display:flex;align-items:center;gap:12px;min-height:56px;padding:6px 10px 6px 6px;border-radius:18px;background:var(--ki-surface-3, #333);text-align:left;width:100%}
    .swr.big{min-height:64px;padding:8px 14px 8px 8px;border-radius:24px;background:var(--ki-surface, #3a3a3a)}
    .swi{width:40px;height:40px;border-radius:20px;flex:none;display:grid;place-items:center;background:var(--ki-surface-2, #4a4a4a)}.swr.big .swi{width:44px;height:44px;border-radius:22px}
    .swn{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.swn b{font-size:14px;font-weight:500}.swr.big .swn b{font-size:15px}.swn span{font-size:12px;color:var(--ki-text-mid, #979797);line-height:1.35}
    .trk{width:46px;height:28px;border-radius:999px;flex:none;position:relative;background:var(--ki-ctrl, #555);transition:background .25s}.trk.on{background:${ACC}}
    .trk i{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:var(--ki-knob, #fff);box-shadow:0 1px 3px ${KA(0.35)};transition:left .25s cubic-bezier(.3,1.4,.5,1)}.trk.on i{left:21px}
    .tsc{display:flex;flex-direction:column;gap:12px;padding:14px;border-radius:24px;background:var(--ki-surface, #3a3a3a);text-align:left;transition:background .2s,box-shadow .2s;width:100%}
    .tsc.on{background:var(--ki-surface-2, #404040);box-shadow:inset 0 0 0 1.5px rgb(242 133 201)}
    .tsc .tsh{display:flex;align-items:center;gap:8px;width:100%}.tsc .tsh b{flex:1;font-size:15px;font-weight:500}.tsc .tsh span{font-size:12px;color:var(--ki-text-mid, #979797)}
    .tsc .ck{color:rgb(242 133 201);opacity:0;transition:opacity .2s;display:flex}.tsc.on .ck{opacity:1}
    .tsp{display:flex;width:100%;pointer-events:none;padding:10px 8px;border-radius:18px;background:var(--ki-popup, #303030)}
    .ucs{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:24px;background:var(--ki-surface, #3a3a3a)}
    .ucs .uh{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:500}.ucs .uh i{width:24px;height:24px;border-radius:12px;background:var(--ki-surface-2, #4a4a4a);display:grid;place-items:center;font-size:12px;font-weight:600;font-style:normal}
    .chips{display:flex;flex-wrap:wrap;gap:6px}
    .chips button{height:34px;padding:0 12px 0 9px;border-radius:17px;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:500;background:var(--ki-surface-3, #333);color:var(--ki-text-1, #d6d6d6);transition:background .2s,transform .15s}
    .chips button:active{transform:scale(.96)}.chips button.on{background:${ACC};color:${INK2}}.chips button.oth{background:var(--ki-surface-2, #4a4a4a);color:var(--ki-text-3, #7f7f7f)}
    .trk.g{width:50px;height:30px;border-radius:15px;background:var(--ki-ctrl, #545454);transition:background .2s}.trk.g.on{background:rgb(102 209 158)}
    .trk.g i{top:3px;left:3px;width:24px;height:24px;border-radius:12px;box-shadow:none;background:var(--ki-text-1, #c7c7c7);transition:left .2s}.trk.g.on i{left:23px;background:var(--ki-on-accent, #2f2f2f)}
    .acc{display:flex;flex-direction:column;border-radius:24px;background:var(--ki-surface, #3a3a3a);overflow:hidden}
    .accb{display:flex;align-items:center;gap:12px;width:100%;min-height:64px;box-sizing:border-box;padding:8px 14px 8px 8px;text-align:left;color:inherit;font:inherit;-webkit-tap-highlight-color:transparent}
    .accc{display:flex;color:var(--ki-text-mid, #979797);transition:transform .25s}.acc.op .accc{transform:rotate(180deg)}
    .accx{display:flex;flex-direction:column;gap:10px;padding:4px 14px 14px;animation:fade .2s ease}
    .accx .bl{font-size:12px;color:var(--ki-text-mid, #979797);padding-left:4px}
    .accx .tsc{background:var(--ki-surface-3, #333)}.accx .tsc.on{background:var(--ki-surface-2, #404040)}
    .ucs.in{padding:0;background:none;border-radius:0}
    .wait{display:flex;align-items:center;gap:10px;padding:14px 16px;border-radius:22px;background:var(--ki-surface, #3a3a3a);color:var(--ki-text-2, #afafaf);font-size:13px}
  `;
  const swH = (on) => `<span class="trk${on ? ' on' : ''}"><i></i></span>`;
  const swG = (on) => `<span class="trk g${on ? ' on' : ''}"><i></i></span>`; // designets grønne bryter (Toppkort → Spotpris-merke)
  const TP = {
    // inSheet: arket (med tittel/Nullstill/Ferdig); ellers GUI-editoren (bare fanene)
    html(ctx, inSheet) {
      const c = ctx.cfg || {}, st = ctx.st, h = hidOf(c), tab = st.tab || 'faner';
      const tabs = [['faner', 'Faner', 'mdi:view-agenda-outline'], ['ent', 'Entiteter', 'mdi:access-point'], ['kurs', 'Kurser', 'mdi:power-plug-outline'], ['vis', 'Visning', 'mdi:tune']];
      let body = '';
      if (tab === 'faner') {
        const order = st.drag ? st.drag.order : orderOf(c), V = visTabs(c), startK = (() => { const s = startOf(c); return V.includes(s) ? s : V[0]; })();
        body = `<span class="hint">Dra for å flytte · øyet skjuler · pilen viser seksjonene. Du kan også holde inne på faner og kort i popupen og dra.</span>
          <div style="display:flex;flex-direction:column;gap:6px" data-tplist>${order.map((k) => {
            const hd = !!h[k], op = st.open === k, subs = SECS[k], icon = TABDEF.find((t) => t[0] === k)[1];
            return `<div class="trw${hd ? ' hd' : ''}${st.drag && st.drag.k === k ? ' dg' : ''}" data-tk="${k}" data-key="tr-${k}"><span class="drg" data-tdrag="${k}">${ic('mdi:drag', 22)}</span>${ic(icon, 22, `color:${hd ? 'var(--ki-text-3, #7f7f7f)' : 'var(--ki-text-1, #e1e1e1)'};width:24px`)}
              <span class="tl" data-a="open" data-v="${k}">${k}<small>${subs.filter((x) => !h[x[0]]).length}/${subs.length} seksjoner</small>${startK === k ? '<span class="stp">Start</span>' : ''}</span>
              <button class="chv${op ? ' up' : ''}" data-a="open" data-v="${k}" title="Seksjoner">${ic('mdi:chevron-down', 22)}</button>
              <button class="eye${hd ? '' : ' on'}" data-a="eye" data-v="${k}" title="Vis / skjul">${ic(hd ? 'mdi:eye-off' : 'mdi:eye', 22)}</button></div>
              ${op ? `<div class="subs">${secOrder(c, k).map((sk) => { const sd = SECS[k].find((x) => x[0] === sk), sh = !!h[sk]; return `<div class="sbr${sh ? ' hd' : ''}"><span class="si">${ic(sd[2], 20)}</span><span class="sl">${esc(sd[1])}</span><button class="eye s${sh ? '' : ' on'}" data-a="eye" data-v="${sk}" title="Vis / skjul">${ic(sh ? 'mdi:eye-off' : 'mdi:eye', 20)}</button></div>`; }).join('')}</div>` : ''}`;
          }).join('')}</div>`;
      } else if (tab === 'ent') {
        const ov = c.ent || {}, A = autoEnts(ctx.hass);
        // Fiks 47 S.2: «Kilder (strømregning)» – config sensorer.<nøkkel> (M.stromRegning.FIELDS) + sensorer.moms_bryter.
        // Rad-nøkkel «S:<nøkkel>» skiller dem fra ent-rollene. Auto = standardkilden når den finnes (aldri gjettet).
        const SR = M.stromRegning, so = isObj(c.sensorer) ? c.sensorer : {};
        const srAuto = (k) => { if (k === 'moms_bryter') return entOf(ctx.hass, c, 'tg_moms'); const id = SR && SR.STANDARD ? SR.STANDARD[k] : null; return id && ctx.hass && ctx.hass.states[id] ? id : null; };
        const row = ([k, name, icon, dom]) => {
            const sk = /^S:/.test(k) ? k.slice(2) : null;
            const op = st.ent === k, custom = sk ? !!so[sk] : !!ov[k], cur = sk ? so[sk] || srAuto(sk) : ov[k] || A[k];
            const s = cur && ctx.hass && ctx.hass.states[cur];
            const val = cur ? `${cur}${s ? ' · ' + (ctx.hass.formatEntityState ? ctx.hass.formatEntityState(s) : s.state) : ' · finnes ikke'}` : 'Ingen funnet – velg entitet';
            let sug = '';
            if (op) {
              const q = String(st.q || '').toLowerCase().trim(), rx = dom || /^(sensor|input_number)\./;
              const L = ctx.hass ? Object.keys(ctx.hass.states).filter((id) => rx.test(id) && (!q || txt(ctx.hass, id).includes(q))).slice(0, 8) : [];
              sug = L.map((id) => `<button data-a="pick" data-k="${k}" data-v="${esc(id)}"><b>${esc(M.name(ctx.hass, id))}</b><span>${esc(id)}</span></button>`).join('');
            }
            return `<div class="er${op ? ' op' : ''}" data-key="er-${k}" data-role="${k}"><button class="erb" data-a="ent" data-v="${k}"><span class="eri">${ic(icon, 22)}</span><span class="ern"><b>${name}</b><span>${esc(val)}</span></span><span class="bdg${custom ? ' c' : ''}">${custom ? 'Valgt' : 'Auto'}</span>${ic('mdi:chevron-down', 22, `color:var(--ki-text-mid, #979797);transition:transform .25s;${op ? 'transform:rotate(180deg)' : ''}`)}</button>
              ${op ? `<div class="erx"><div class="srch">${ic('mdi:magnify', 20, 'color:var(--ki-text-2, #afafaf)')}<input data-in="q" data-k="${k}" value="${esc(st.q != null ? st.q : (sk ? so[sk] : ov[k]) || '')}" placeholder="${dom ? 'input_boolean.… / switch.…' : 'sensor.…'}" spellcheck="false"></div>${sug ? `<div class="sug">${sug}</div>` : ''}
                ${custom ? `<button class="auto" data-a="auto" data-v="${k}">${ic('mdi:autorenew', 20)}Bruk automatisk</button>` : ''}</div>` : ''}</div>`;
        };
        body = `<div class="info">${ic('mdi:sync', 22, 'color:rgb(115 185 242)')}<span>Entitetene (kildene) finnes automatisk i Home Assistant. Overstyr bare det som skal være annerledes.</span></div>
          ${ROLE_GROUPS.map(([gl, gs, keys]) => `<span class="lab">${esc(gl)}</span>${gs ? `<span class="hint">${esc(gs)}</span>` : ''}${keys.map((k) => row(ROLES.find((r) => r[0] === k))).join('')}`).join('')}
          ${SR && Array.isArray(SR.FIELDS) ? `<span class="lab">Kilder (strømregning)</span><span class="hint">Strømregning- og Norgespris-sidene · config sensorer</span>
            ${(() => { const A1 = st.acc || (st.acc = {}), n = Object.keys(so).length; return `<div class="acc${A1.sr ? ' op' : ''}" data-key="acc-sr" data-acc="sr"><button class="accb" data-a="acc" data-v="sr" aria-expanded="${!!A1.sr}"><span class="eri">${ic('mdi:receipt-text-outline', 22)}</span><span class="ern"><b>Strømregning og Norgespris</b><span>${SR.FIELDS.length + 1} kilder · ${n ? n + ' valgt' : 'alle automatisk'}</span></span><span class="accc">${ic('mdi:chevron-down', 22)}</span></button>${A1.sr ? `<div class="accx">${[...SR.FIELDS.map(([k2, l2]) => ['S:' + k2, l2, 'mdi:access-point']), ['S:moms_bryter', 'Moms-bryter', 'mdi:cash-multiple', /^(input_boolean|switch)\./]].map(row).join('')}</div>` : ''}</div>`; })()}` : ''}`;
      } else if (tab === 'kurs') {
        const K = M.stromKurser;
        body = `<div class="info">${ic('mdi:file-tree', 22, 'color:rgb(115 185 242)')}<span>Full kontroll over kategorier og kurser – samme oppsett som ki-energi-card-strom. Trykk blyanten for å redigere navn, ikon, farge og entiteter.</span></div>`;
        if (K && typeof K.editorHtml === 'function') { let x = ''; try { x = K.editorHtml(ctx.host, c.kurs); } catch (e) { x = `<div class="wait">${ic('mdi:alert-circle-outline', 20)}Kurser-editoren feilet: ${esc(e.message || e)}</div>`; } body += `<div data-skedit style="display:flex;flex-direction:column;gap:8px">${x}</div>`; }
        else body += `<div class="wait">${ic('mdi:timer-sand', 20)}Kurser-editoren lastes …</div>`;
      } else {
        const V = visTabs(c), sv = startOf(c), stK = V.includes(sv) ? sv : V[0];
        const ep = exPriceOf(c), exOn = exShowOf(c);
        let P = null; try { P = ctx.hass ? M.powerPrice(ctx.hass, M.powerPriceCfg(null, { spot_entity: entOf(ctx.hass, c, 'spot') || '', mode: ep === 'total' ? 'total' : 'spot', unit: 'kr' })) : null; } catch (e) { P = null; }
        const nE = entOf(ctx.hass, c, 'norge');
        const pv = ep === 'norge' ? (nE ? priceVal(ctx.hass, nE) : P && P.norgespris ? P.norgespris.v : null) : P ? P.now : null;
        const pe = ep === 'norge' ? nE || 'Fast sats (strømpris-kilden)' : (P && P.entity) || 'Ingen pris-entitet';
        const pl = PRS.find((x) => x[0] === ep)[1];
        const uc = ucOf(c);
        const big = c.cardSize !== 'kompakt', gear = c.gear === 'tab' ? 'tab' : 'hero';
        const ga = M.glassAnimOn ? M.glassAnimOn() : true;
        // Fiks 47 O: lange seksjoner som akkordeon (lukket som standard; åpen/lukket er bare visning – st.acc, aldri config)
        const A0 = st.acc || (st.acc = {});
        const acc = (k, icon, title, sub, inner) => `<div class="acc${A0[k] ? ' op' : ''}" data-key="acc-${k}" data-acc="${k}"><button class="accb" data-a="acc" data-v="${k}" aria-expanded="${!!A0[k]}"><span class="eri">${ic(icon, 22)}</span><span class="ern"><b>${esc(title)}</b><span>${esc(sub)}</span></span><span class="accc">${ic('mdi:chevron-down', 22)}</span></button>${A0[k] ? `<div class="accx">${inner}</div>` : ''}</div>`;
        body = `<span class="lab">Startfane</span>
          <div class="sg" data-glass-drag="x">${V.map((k) => `<button class="${stK === k ? 'on' : ''}" data-a="start" data-v="${k}">${k}</button>`).join('')}${M.startTab ? `<button class="${sv === 'last' ? 'on' : ''}" data-a="start" data-v="last">Sist brukte</button>` : ''}</div>
          <span class="lab">Hva koster det nå</span>
          ${acc('ex', 'mdi:calculator', 'Pris og eksempler', `${ep === 'total' ? 'Totalpris' : pl} · ${exOn.length} eksempler`, `<span class="bl">Pris som brukes</span>
            <div class="sg in" data-glass-drag="x">${PRS.map(([k, l]) => `<button class="${ep === k ? 'on' : ''}" data-a="exp" data-v="${k}">${k === 'total' ? 'Totalpris' : l}</button>`).join('')}</div>
            <div class="entc">${ic('mdi:access-point', 20, 'color:var(--ki-text-2, #afafaf)')}<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><b>${esc(pe)}</b><span>${esc(pl)} · ${pv != null ? nf(pv, 2) : '–'} kr/kWh nå</span></span></div>
            <span class="bl" style="padding-top:4px">Eksempler som vises</span>
            ${EXALL.map(([id, icon, l, kwh]) => `<button class="swr" data-a="exs" data-v="${id}"><span class="swi">${ic(icon, 20)}</span><span class="swn"><b>${esc(l)}</b><span>~${nf(kwh, kwh < 1 ? 2 : 1)} kWh · ${pv != null ? nf(kwh * pv, kwh * pv >= 10 ? 1 : 2) : '–'} kr</span></span>${swH(exOn.includes(id))}</button>`).join('')}`)}
          <span class="lab">Fanelinje</span>
          ${acc('ts', 'mdi:tab', 'Stil på fanelinjen', `${TSTY[tsOf(c)].name} · ${Object.keys(TSTY).length} stiler`, Object.keys(TSTY).map((k) => `<button class="tsc${tsOf(c) === k ? ' on' : ''}" data-a="ts" data-v="${k}"><span class="tsh"><b>${TSTY[k].name}</b><span>${TSTY[k].sub}</span><span class="ck">${ic('mdi:check-circle', 20)}</span></span><span class="tsp">${tabBarHTML(c, null, true, k)}</span></button>`).join(''))}
          <span class="lab">Forbruk-kort · hold inne på kortene i popupen for å bytte plass</span>
          ${acc('uc', 'mdi:view-grid-outline', 'Kortene i Forbruk', uc.map((k) => UC[k][1]).join(' · '), [0, 1].map((si) => `<div class="ucs in"><span class="uh"><i>${si + 1}</i>${si ? 'Høyre kort' : 'Venstre kort'}</span><div class="chips">${Object.keys(UC).map((k) => `<button class="${uc[si] === k ? 'on' : uc[1 - si] === k ? 'oth' : ''}" data-a="uc" data-s="${si}" data-v="${k}">${ic(UC[k][0], 16)}${esc(UC[k][1])}</button>`).join('')}</div></div>`).join(''))}
          <span class="lab">Regning-kort</span>
          <div class="sg" data-glass-drag="x"><button class="${!big ? 'on' : ''}" data-a="size" data-v="kompakt">${ic('mdi:arrow-collapse-vertical', 18)}Kompakt</button><button class="${big ? 'on' : ''}" data-a="size" data-v="stor">${ic('mdi:arrow-expand-vertical', 18)}Stor</button></div>
          <span class="lab">Tannhjul (Tilpass)</span>
          <div class="sg" data-glass-drag="x"><button class="${gear === 'hero' ? 'on' : ''}" data-a="gear" data-v="hero">${ic('mdi:application-outline', 18)}Toppkort</button><button class="${gear === 'tab' ? 'on' : ''}" data-a="gear" data-v="tab">${ic('mdi:tab', 18)}Fanelinje</button></div>
          <span class="lab">Toppkort</span>
          <button class="swr big" data-a="spotchip"><span class="swi">${ic('mdi:tag-outline', 22)}</span><span class="swn"><b>Spotpris-merke</b><span>«Spotpris middels · 1,49 kr» under watt</span></span>${swG(c.spot_chip !== false && c.spotChip !== false)}</button>
          <span class="lab">Effekter</span>
          ${[['anim', 'Animasjoner', 'mdi:animation', 'Glød i toppkortet, grafer som tegnes og søyler som vokser', c.anim !== false], ['glass', 'Liquid glass', 'mdi:blur', 'Dra over fanelinjer for glass-linse som følger fingeren', ga], ['live', 'Live effekt', 'mdi:access-point', 'Oppdater watt i toppkortet fortløpende', c.live !== false]]
            .map(([k, l, icon, sub, on]) => `<button class="swr big" data-a="sw" data-v="${k}"><span class="swi">${ic(icon, 22)}</span><span class="swn"><b>${l}</b><span>${sub}</span></span>${swH(on)}</button>`).join('')}`;
      }
      const head = inSheet ? `<div class="tph" data-sheet-head><span class="tt">Tilpass strøm</span><button class="rs" data-a="reset">Nullstill</button><button class="dn" data-a="done">Ferdig</button></div>` : '';
      return `<div class="tp">${head}<div class="tpt" data-glass-drag="x">${tabs.map(([k, l, icon]) => `<button class="${tab === k ? 'on' : ''}" data-a="tptab" data-v="${k}" title="${l}">${ic(icon, 20)}${tab === k ? `<span>${l}</span>` : ''}</button>`).join('')}</div><div class="tpb">${body}</div></div>`;
    },
    bind(root, ctx) {
      if (M.glassDrag) root.querySelectorAll('[data-glass-drag]').forEach((s) => M.glassDrag(s, { axis: 'x', touchAction: 'pan-y' }));
      const ed = root.querySelector('[data-skedit]');
      if (ed && M.stromKurser && M.stromKurser.editorBind) { try { M.stromKurser.editorBind(ctx.host, ed, ctx.cfg.kurs, (k) => ctx.set({ kurs: k == null ? null : k })); } catch (e) { console.error('msh-strom', 'editorBind', e); } }
      if (root.__tpb) { root.__tpb.ctx = ctx; return; }
      const S = (root.__tpb = { ctx });
      const C = () => S.ctx;
      root.addEventListener('click', (e) => {
        const el = e.target.closest && e.target.closest('[data-a]');
        if (!el || !root.contains(el)) return;
        const x = C(), c = x.cfg || {}, st = x.st, a = el.dataset.a, v = el.dataset.v, h = hidOf(c);
        const hp = (t) => M.haptic(t || 'selection');
        switch (a) {
          case 'tptab': hp(); st.tab = v; st.q = null; return x.rerender();
          case 'done': hp('light'); if (M.flushSaves) M.flushSaves(); return x.close && x.close();
          case 'reset': hp('warning'); return x.set({ order: null, hid: null, ent: null, start: null, start_tab: null, anim: null, live: null, tabStyle: null, gear: null, cardSize: null, useCards: null, exPrice: null, exShow: null, spot_chip: null, spotChip: null, sensorer: null, ord: c.ord && (c.ord.kurs || c.ord.cat) ? { kurs: c.ord.kurs, cat: c.ord.cat } : null });
          case 'open': hp(); st.open = st.open === v ? null : v; return x.rerender();
          case 'eye': {
            const isTab = TABK.includes(v);
            if (isTab && !h[v] && visTabs(c).length < 2) { hp('warning'); return; }
            hp(); const nh = { ...(isObj(c.hid) ? c.hid : {}) };
            if (v === 'p_minis' && h[v]) nh[v] = false; else if (h[v]) delete nh[v]; else nh[v] = true;
            return x.set({ hid: Object.keys(nh).length ? nh : null });
          }
          case 'ent': hp(); st.ent = st.ent === v ? null : v; st.q = null; return x.rerender();
          case 'pick': { hp('success'); st.q = null; const k = el.dataset.k; if (/^S:/.test(k)) return x.set({ sensorer: { ...(isObj(c.sensorer) ? c.sensorer : {}), [k.slice(2)]: v } }); return x.set({ ent: { ...(c.ent || {}), [k]: v } }); }
          case 'auto': { hp(); st.q = null; if (/^S:/.test(v)) { const o = { ...(isObj(c.sensorer) ? c.sensorer : {}) }; delete o[v.slice(2)]; return x.set({ sensorer: Object.keys(o).length ? o : null }); } const o = { ...(c.ent || {}) }; delete o[v]; return x.set({ ent: Object.keys(o).length ? o : null }); }
          case 'start': hp(); return x.set({ start: v === 'last' ? null : v, start_tab: v === 'last' ? 'last' : null });
          case 'exp': hp(); return x.set({ exPrice: v });
          case 'exs': { hp(); const on = exShowOf(c); return x.set({ exShow: on.includes(v) ? on.filter((k) => k !== v) : EXALL.map((k) => k[0]).filter((k) => k === v || on.includes(k)) }); }
          case 'ts': hp(); return x.set({ tabStyle: v });
          case 'acc': { hp('light'); st.acc = { ...(st.acc || {}), [v]: !(st.acc && st.acc[v]) }; return x.rerender(); }
          case 'spotchip': { hp(); const on = c.spot_chip !== false && c.spotChip !== false; return x.set({ spot_chip: on ? false : null, spotChip: null }); }
          case 'uc': { hp(); const si = Number(el.dataset.s), cur = ucOf(c), nx = cur.slice(); if (cur[1 - si] === v) nx[1 - si] = cur[si]; nx[si] = v; return x.set({ useCards: nx }); }
          case 'size': hp(); return x.set({ cardSize: v });
          case 'gear': hp(); return x.set({ gear: v });
          case 'sw': {
            hp();
            if (v === 'glass') { if (M.setGlassAnim) M.setGlassAnim(!(M.glassAnimOn ? M.glassAnimOn() : true)); return x.rerender(); }
            if (v === 'anim') return x.set({ anim: c.anim === false ? null : false });
            if (v === 'live') return x.set({ live: c.live === false ? null : false });
            return;
          }
          default:
        }
      });
      // søk/overstyring av entitet: input viser forslag, Enter/endring lagrer
      root.addEventListener('input', (e) => { const el = e.target; if (!el.dataset || el.dataset.in !== 'q') return; C().st.q = el.value; C().rerender(); });
      root.addEventListener('change', (e) => {
        const el = e.target; if (!el.dataset || el.dataset.in !== 'q') return;
        const x = C(), v = el.value.trim(), k0 = el.dataset.k, sr = /^S:/.test(k0), k = sr ? k0.slice(2) : k0, o = { ...((sr ? x.cfg.sensorer : x.cfg.ent) || {}) };
        if (!v) delete o[k]; else if (/^[a-z_]+\.[a-z0-9_]+$/.test(v)) o[k] = v; else return;
        M.haptic('selection'); x.st.q = null; x.set({ [sr ? 'sensorer' : 'ent']: Object.keys(o).length ? o : null });
      });
      // Faner: dra i håndtaket (touch-action none + stopPropagation), 66 px per plass som i designet
      root.addEventListener('pointerdown', (e) => {
        const hd = e.target.closest && e.target.closest('[data-tdrag]');
        if (!hd || e.button) return;
        e.preventDefault(); e.stopPropagation();
        const x = C(), base = orderOf(x.cfg), k = hd.dataset.tdrag, i = base.indexOf(k), y0 = e.clientY;
        let cur = i;
        x.st.drag = { k, order: base.slice() };
        M.haptic('medium'); x.rerender();
        try { hd.setPointerCapture(e.pointerId); } catch (z) { /* */ }
        const mv = (ev) => { ev.stopPropagation(); const to = Math.max(0, Math.min(base.length - 1, i + Math.round((ev.clientY - y0) / 66))); if (to !== cur) { cur = to; const o = base.slice(); o.splice(to, 0, o.splice(i, 1)[0]); C().st.drag = { k, order: o }; M.haptic('selection'); C().rerender(); } };
        const up = () => { window.removeEventListener('pointermove', mv, true); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); const y = C(), o = y.st.drag && y.st.drag.order; y.st.drag = null; if (o && JSON.stringify(o) !== JSON.stringify(base)) { M.haptic('light'); y.set({ order: o }); } else y.rerender(); };
        window.addEventListener('pointermove', mv, true); window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
      });
      ['touchstart', 'touchmove'].forEach((t) => root.addEventListener(t, (e) => { if (e.target.closest && e.target.closest('[data-tdrag]')) e.stopPropagation(); }, { passive: true }));
    },
  };
  M.stromTilpass = TP;

  /* ================================================================ GUI-editor (getConfigElement) – samme valg, samme nøkler */
  class StromEditor extends HTMLElement {
    constructor() { super(); this.attachShadow({ mode: 'open' }); this._st = { tab: 'faner' }; this._ui = {}; }
    setConfig(c) {
      let eff = c || {};
      try { eff = M.effectiveConfig ? M.effectiveConfig(c) : c; } catch (e) { eff = c; }
      if (this._last && JSON.stringify(c) === this._last) return;
      this._cfg = { ...eff };
      this._r();
    }
    set hass(h) { const first = !this._h; this._h = h; if (first) this._r(); }
    get hass() { return this._h || M.lastHass; }
    _host() {
      const ed = this;
      return { get hass() { return ed.hass; }, get config() { return ed._cfg || {}; }, root: this.shadowRoot, ui: this._ui, anim: true,
        setCfg: (p) => ed._set(p), render: () => ed._r(), go: () => {}, haptic: (t) => M.haptic(t), ent: (role) => entOf(ed.hass, ed._cfg, role), sec: () => [] };
    }
    _set(patch) {
      const next = { ...(this._cfg || {}) };
      Object.keys(patch || {}).forEach((k) => { if (patch[k] == null) delete next[k]; else next[k] = patch[k]; });
      this._cfg = next;
      try { this._last = JSON.stringify(next); } catch (e) { this._last = null; }
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next }, bubbles: true, composed: true }));
      if (M.store && next.card_id && M.store.card && M.store.card(next.card_id)) { try { M.store.setCard(next.card_id, next); } catch (e) { /* */ } } // GUI ↔ Tilpass-arket (ki-store)
      this._r();
    }
    _r() {
      if (!this._cfg) return;
      const host = this._host();
      const ctx = { host, hass: this.hass, cfg: this._cfg, st: this._st, set: (p) => this._set(p), rerender: () => this._r(), close: null };
      const html = `<style>${M.BASE_CSS}${TP_CSS}${(M.stromKurser && M.stromKurser.css) || ''}:host{display:block}.tp{padding:4px 0}</style>${TP.html(ctx, false)}`;
      if (!this._done) { this.shadowRoot.innerHTML = html; this._done = true; } else M.morph(this.shadowRoot, html);
      TP.bind(this.shadowRoot, ctx, false);
    }
  }
  if (!customElements.get('msh-strom-editor')) customElements.define('msh-strom-editor', StromEditor);
  customElements.define('msh-strom-card', StromCard);
  window.customCards = window.customCards || [];
  window.customCards.push({ type: 'msh-strom-card', name: 'MSH Strøm', description: 'Strøm-popup (#strom): toppkort, priser, forbruk, kurser og undersider' });
  M.POPUP_CARDS = M.POPUP_CARDS || [];
  if (Array.isArray(M.POPUP_CARDS) && !M.POPUP_CARDS.includes('msh-strom-card')) M.POPUP_CARDS.push('msh-strom-card');

  /* ------------------------------------------------------------ #norgespris / #stromregning → underside i #strom */
  const popupAt = (hash) => {
    let found = false;
    const w = (r, d) => { if (found || !r || d > 14 || !r.querySelectorAll) return; r.querySelectorAll('bubble-card').forEach((b) => { const c = b.config || b._config; if (c && c.card_type === 'pop-up' && c.hash === hash) found = true; }); if (!found) r.querySelectorAll('*').forEach((x) => { if (x.shadowRoot) w(x.shadowRoot, d + 1); }); };
    w(document, 0);
    return found;
  };
  M.stromRedirect = function () {
    const hh = decodeURIComponent(location.hash || ''), page = PAGE_HASH[hh];
    if (!page || popupAt(hh)) return false; // egen popup under den gamle hashen vinner
    M.__stromPage = { page, t: Date.now() };
    (M.liveCards ? [...M.liveCards.values()].flatMap((s) => [...s]) : []).forEach((card) => { if (card.localName === 'msh-strom-card' && card._ui) { card._ui.page = page; card.update(); } });
    try {
      const old = location.href;
      history.replaceState(history.state, '', location.pathname + location.search + HASH);
      window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL: old, newURL: location.href }));
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: true } }));
      return true;
    } catch (x) { return false; }
  };
  ['hashchange', 'location-changed', 'popstate'].forEach((ev) => window.addEventListener(ev, () => M.stromRedirect(), true)); // capture: før Bubble Card leser hashen
  setTimeout(() => M.stromRedirect(), 0);
})();
