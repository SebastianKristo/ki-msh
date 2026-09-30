/* KI MSH · Tesla (#tesla, fiks 24.8) – ett kort i popupen: msh-tesla-card.
 *
 * Innhold i rekkefølge (Tesla v3 + ki-tesla-card.js):
 *   1. Toppkort: bilscenen (msh-tesla-scene, flyttet uendret fra ki-cards/src/84-ki-tesla-card.js, 180 px, r28,
 *      tap_action: none). Får samme hass og navn/lakk/kapasitet/laas_omvendt + entitetene fra popupens config.
 *   2. Hurtigknapper (5 kolonner, kvadratiske, r24): Lås (oransje + «rist» når ulåst), Tut (button.press), Defrost
 *      (rosa + «pust»), Frunk, Bagasje (rosa når åpen). Bekreftelse (portalt) når confirm er på. Hold → more-info.
 *   3. Faner (Liquid Glass, MSH.tabReorder: dra = omorganiser, stil Fylt/Kontur, innhold Tekst/Ikoner/Ikon + aktiv/Begge)
 *      + 48 px tannhjul → «Tilpass Tesla».
 *   4. Lading: status + effekt, Start/Stopp (lader-bryteren), dra-bar for ladegrense (50–100, steg 5, input_number/
 *      number.set_value, touch-action none + stopPropagation), grenseknapper, oppsummering (tid til grense · pris · sist
 *      lading fra sensor.ki_tesla_*), Smartlading med timepriser (felles strømpris-kilde, billigste timer rosa).
 *   5. Kjøring: rekkevidde med grensemarkør, daglig km siste 7 dager (recorder/statistics_during_period per dag, trykk
 *      velger dag), kilometerstand + snitt.
 *   6. Sparing (KI Drivstoff): spart måned/år, diesel vs strøm, «% billigere enn diesel», kr/mil Tesla vs diesel, liter og
 *      CO₂ spart, spart per dag siste 30 dager (scrub), prislinje. Mangler dieselpris → «Pumpepris mangler» (ki_drivstoff.hent_pris).
 * «Tilpass Tesla» = msh-editor (samme skjema i getConfigElement): Bil (navn, lakk, kapasitet, hurtigknapper) · Faner
 * (live forhåndsvisning, dra-og-slipp, vis/skjul, stil, innhold, startfane, ladegrense-knapper) · Entiteter (søkevelger,
 * gruppert) · Avansert (lås omvendt, bekreftelse, prefiks, mellomrom, tilbakestill).
 * Config: name, paint, capacity, button_text, buttons{lock,honk,defrost,frunk,trunk:{show,entity,confirm}},
 *   tabs{order,hidden,start,style,content}, limits[], entities{…}, lock_inverted, confirm, prefix.
 * Entiteter autofinnes via prefiks (standard tesla_model_y, folkevogn, tesla) / Tesla-plattform + mønstre (entiteter.md:
 * domene + navn); KI Drivstoff via sensor.ki_drivstoff_*. Aldri mock – mangler noe: «–» + «Velg entitet».
 */

/* ================================================================ del 1 · bilscenen (msh-tesla-scene)
 * Flyttet uendret fra ki-cards/src/84-ki-tesla-card.js (ki-cards endres ikke). Eneste endringer: elementnavnet
 * (msh-tesla-scene, ikke i kortvelgeren) og ingen hardkodede standard-entiteter (popupen sender alle entitetene). */
// ki-tesla-card – animert Tesla Model Y i samme stil som ki-varmepumpe-card og ki-homelab-card.
//  
//    Scenen viser bilen fra siden:
//     – batteriet i dørterskelen fylles til batterinivået, med en markør for ladegrensen
//     – ved lading strømmer energi fra laderen gjennom kabelen, og batteriet glitrer
//     – frunk og bagasjerom åpnes i tegningen når de står åpne
//     – defrost gir varmebølger på frontruta, sentry blinker rødt
//     – vinduer på gløtt: en svart glipe øverst i vinduene og luft som strømmer ut
//     – når bilen kjører, ruller hjulene og veien glir forbi i takt med farten
//     – ladeporten i baklyset åpnes og lyser når porten er åpen, grønt når kabelen står i
//     – låseikonet over taket er oransje og vipper når bilen er ulåst
//  
//    Alle entiteter har standardverdier. Frunk, sentry, klima, innetemperatur, gir og fart
//    letes opp automatisk blant entiteter som starter med prefiksene (folkevogn, tesla_model_y).
//  
//    type: custom:ki-tesla-card
//    navn: Tesla Model Y
//    lakk: "#7b92ac"          # bilens farge (standard: blågrå som på bildet)
//    kapasitet: 75            # kWh, brukes til å anslå når ladingen er ferdig
//    tap_action: { action: navigate, navigation_path: "#tesla" }
//
(() => {
  const STANDARD = {
    navn: "Tesla Model Y",
    lakk: "#7b92ac",
    kapasitet: 75,
    prefiks: ["folkevogn", "tesla_model_y"],
    // ki-msh: ingen hardkodede entiteter (CLAUDE.md fallgruve 4) – msh-tesla-card sender alle (null = mangler)
    batteri: null, rekkevidde: null, effekt: null, ladestatus: null, ladeport: null, lader: null, ladegrense: null, laas: null,
    /* Bryteren heter «doors_locked», men `on` betyr ÅPEN. Navnet sier altså det
       motsatte av verdien, og derfor er tolkningen et eget valg i stedet for noe koden
       gjetter seg til. Bruker du en ekte `lock.`-entitet, sett `laas_omvendt: false`. */
    laas_omvendt: true,
    bagasje: null,
    frunk: null, sentry: null, klima: null, innetemp: null, gir: null, fart: null,
    // defrost kan være én entitet eller en liste – animasjonen vises hvis én av dem er på
    defrost: null,
    vindu: null,
  };
  const AUTO = {
    frunk: [/^(switch|cover)\..*(frunk|trunk_front|front_trunk|vehicle_state_ft)/],
    sentry: [/^switch\..*sentry/],
    klima: [/^climate\./],
    innetemp: [/^sensor\..*(inside_temp|innetemp|inne_temp|interior)/],
    gir: [/^sensor\..*(shift_state|gir|gear)/],
    fart: [/^sensor\..*(speed|fart|hastighet)$/],
    kabel: [/^binary_sensor\..*(charge_cable|ladekabel|plugged|tilkoblet)/],
  };
  const DAARLIG = ["unavailable", "unknown", "", "none", null, undefined];
  const ok = (s) => s && !DAARLIG.includes(s.state);
  const tall = (s) => { if (!ok(s)) return NaN; const v = parseFloat(String(s.state).replace(",", ".")); return isNaN(v) ? NaN : v; };
  const klem = (v, a, b) => Math.min(b, Math.max(a, v));
  const komma = (v, d = 0) => (isNaN(v) ? "--" : v.toFixed(d).replace(".", ","));

  const STIL = `
    :host { display:block; }
    .tc { position:relative; height:180px; border-radius:var(--ha-card-border-radius,24px); overflow:hidden; isolation:isolate; cursor:pointer; color:#eef3f8;
      background:linear-gradient(165deg,#15191f 0%,#1a1f27 55%,#1f2530 100%); -webkit-tap-highlight-color:transparent; outline:none;
      transition:transform .15s cubic-bezier(.3,1.4,.5,1); }
    .tc:active { transform:scale(.985); }
    .tc:focus-visible { box-shadow:0 0 0 2px var(--active-big,#f5c542); }
    .glod { position:absolute; inset:0; z-index:-1; opacity:0; transition:opacity 1.4s; }
    .tc.lader .glod { opacity:1; background:radial-gradient(70% 90% at 80% 100%, rgba(90,230,160,.30) 0%, transparent 62%); }
    .tc.kjorer .glod { opacity:1; background:radial-gradient(70% 90% at 70% 100%, rgba(90,170,255,.28) 0%, transparent 62%); }
    .tc.lavt .glod { opacity:1; background:radial-gradient(70% 90% at 70% 100%, rgba(255,90,70,.28) 0%, transparent 62%); }
    .tekst { position:absolute; left:20px; top:18px; bottom:14px; display:flex; flex-direction:column; z-index:2; max-width:42%; min-width:0; }
    .n { font-size:15px; color:#afafaf; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    /* Fiks 26.10: status-chippen er bare tekst (ingen ikon), 13 px, pill rgba(255,255,255,.1) */
    .pille { align-self:flex-start; margin-top:8px; display:inline-flex; align-items:center; padding:4px 11px; border-radius:999px;
      font-size:13px; font-weight:500; line-height:18px; background:rgba(255,255,255,.1); white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:ellipsis; }
    .pille.gul { background:rgba(255,179,74,.32) !important; } .pille.rod { background:rgba(255,80,70,.42) !important; }
    .stor { margin-top:auto; font-size:2em; line-height:1.2em; font-weight:300; white-space:nowrap; }
    .stor small { font-size:14px; font-weight:300; margin-left:2px; opacity:.85; }
    .sub { font-size:13px; opacity:.62; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .scene { position:absolute; right:0; bottom:0; width:64%; max-width:320px; height:100%; }
    .scene svg { position:absolute; right:0; bottom:0; width:100%; height:100%; overflow:visible; }
    .scene text { font-family:inherit; }

    .vei { stroke:rgba(255,255,255,.12); stroke-width:1.5; }
    .veistriper { stroke:rgba(255,255,255,.28); stroke-width:1.5; stroke-dasharray:10 14; opacity:0; }
    .tc.kjorer .veistriper { opacity:1; animation:vei var(--vei,.6s) linear infinite; }
    @keyframes vei { to { stroke-dashoffset:24; } }
    .skygge { fill:rgba(0,0,0,.35); }
    .karosseri { fill:var(--lakk); }
    .glass { fill:#1c2530; }
    .glans { fill:none; stroke:rgba(255,255,255,.35); stroke-width:1; }
    .linje { fill:none; stroke:rgba(0,0,0,.18); stroke-width:1; }
    .dekk { fill:#0d0f11; } .felg { fill:#2b3037; } .nav { fill:#1a1d21; }
    .eiker { transform-box:fill-box; transform-origin:center; }
    .tc.kjorer .eiker { animation:rull var(--hjul,.45s) linear infinite; }
    .tc.kjorer .skygge { animation:dump .9s ease-in-out infinite; }
    @keyframes dump { 0%,100% { transform:scaleX(1); } 50% { transform:scaleX(.985); } }
    .skygge { transform-box:fill-box; transform-origin:center; }
    .boks, .boks-led { transition:opacity .6s; } .tc.kjorer .boks, .tc.kjorer .boks-led { opacity:0; }
    .fartlinjer { stroke:rgba(255,255,255,.35); stroke-width:1; stroke-linecap:round; opacity:0; }
    .tc.kjorer .fartlinjer { animation:fartlinje var(--vei,.6s) linear infinite; }
    .tc.kjorer .fl2 { animation-delay:calc(var(--vei,.6s) / -3); } .tc.kjorer .fl3 { animation-delay:calc(var(--vei,.6s) / -1.5); }
    @keyframes fartlinje { 0% { opacity:0; transform:translateX(0); } 20% { opacity:.8; } 100% { opacity:0; transform:translateX(26px); } }
    @keyframes rull { to { transform:rotate(-360deg); } }
    .lys { fill:#f4f9ff; opacity:.7; } .tc.kjorer .lys, .tc.ulast .lys { opacity:1; filter:drop-shadow(0 0 3px #dfefff); }
    .baklys { stroke:#ff3b30; opacity:.6; } .tc.kjorer .baklys, .tc.ulast .baklys { opacity:1; filter:drop-shadow(0 0 2px #ff3b30); }
    .lokk { transform-box:view-box; transition:transform .9s cubic-bezier(.3,1.2,.4,1); }
    .frunk { transform-origin:56.3px 117px; } .tc.frunk-apen .frunk { transform:rotate(22deg); }
    .bak { transform-origin:143px 102px; } .tc.bak-apen .bak { transform:rotate(-34deg); }

    .terskel { fill:#0a0d10; }
    .celle { transition:width 1.4s cubic-bezier(.3,.8,.3,1), fill .6s; }
    .glitter { fill:url(#glitter); opacity:0; } .tc.lader .glitter { opacity:1; animation:glitter 1.6s linear infinite; }
    @keyframes glitter { from { transform:translateX(-30px); } to { transform:translateX(60px); } }
    .grense { stroke:#eef3f8; stroke-width:1.2; opacity:.8; transition:transform 1s; }

    .boks { fill:#232a33; stroke:#3a4452; stroke-width:1; }
    .boks-led { fill:#3a4452; } .tc.tilkoblet .boks-led { fill:#5be38a; } .tc.lader .boks-led { animation:blink 1s steps(2,end) infinite; }
    @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:.3; } }
    .kabel { fill:none; stroke:#2c333d; stroke-width:3; stroke-linecap:round; opacity:0; transition:opacity .6s; }
    .tc.tilkoblet .kabel { opacity:1; }
    .energi { fill:none; stroke:#5ae6a0; stroke-width:2.2; stroke-linecap:round; stroke-dasharray:2 7; opacity:0; }
    .tc.lader .energi { opacity:1; animation:flyt var(--flyt,1s) linear infinite; }
    @keyframes flyt { to { stroke-dashoffset:-18; } }
    .port { fill:#8fd0ff; opacity:0; transition:opacity .5s, fill .5s; }
    .tc.port-apen .port { opacity:1; filter:drop-shadow(0 0 2.5px #8fd0ff); }
    .tc.tilkoblet .port { fill:#5be38a; filter:drop-shadow(0 0 2.5px #5be38a); }
    .tc.lader .port { animation:blink 1.2s ease-in-out infinite; }
    .portluke { transform-box:fill-box; transform-origin:right center; transition:transform .7s cubic-bezier(.3,1.3,.4,1); }
    .tc.port-apen .portluke { transform:translateX(1.2px) scaleX(.22); }

    .dfr { fill:none; stroke:#ff9a5c; stroke-width:1.3; stroke-linecap:round; opacity:0; }
    .tc.defrost .dfr { animation:stig 2.2s ease-out infinite; } .tc.defrost .dfr.d2 { animation-delay:.7s; } .tc.defrost .dfr.d3 { animation-delay:1.4s; }
    @keyframes stig { 0% { opacity:0; transform:translateY(2px); } 30% { opacity:.9; } 100% { opacity:0; transform:translateY(-4px); } }
    .dfr { transform-box:fill-box; }
    .glipe { fill:none; stroke:#04060a; stroke-width:1.7; stroke-linecap:round; opacity:0; transition:opacity .6s; }
    .tc.vindu .glipe { opacity:1; }
    .luft { fill:none; stroke:#bfe4ff; stroke-width:1; stroke-linecap:round; opacity:0; transform-box:fill-box; }
    .tc.vindu .luft { animation:luft 2.6s ease-out infinite; } .tc.vindu .l2 { animation-delay:.9s; } .tc.vindu .l3 { animation-delay:1.7s; }
    @keyframes luft { 0% { opacity:0; transform:translate(0,2px); } 30% { opacity:.8; } 100% { opacity:0; transform:translate(5px,-7px); } }
    .sentrylys { fill:#ff3b30; opacity:0; } .tc.sentry .sentrylys { animation:sentry 1.6s ease-in-out infinite; }
    @keyframes sentry { 0%,100% { opacity:.25; } 50% { opacity:1; filter:drop-shadow(0 0 4px #ff3b30); } }
    .t-inne { font-size:8px; font-weight:600; fill:#eef3f8; opacity:.85; }

    .laas { transform-box:fill-box; transform-origin:center; }
    .laas-sirkel { fill:rgba(238,243,248,.12); transition:fill .5s; }
    .laas-bue { fill:none; stroke:#eef3f8; stroke-width:1.6; stroke-linecap:round; transition:transform .4s; transform-box:fill-box; transform-origin:right bottom; }
    .laas-kropp { fill:#eef3f8; }
    .tc.ulast .laas-sirkel { fill:#ffb34a; } .tc.ulast .laas-bue { stroke:#1a1f27; transform:translateY(-1.5px) rotate(-25deg); } .tc.ulast .laas-kropp { fill:#1a1f27; }
    .tc.ulast .laas { animation:vipp 3s ease-in-out infinite; }
    @keyframes vipp { 0%,85%,100% { transform:rotate(0); } 90% { transform:rotate(-10deg); } 95% { transform:rotate(10deg); } }
    @media (prefers-reduced-motion: reduce) { .tc * { animation:none !important; } }
    @media (max-width:380px) { .scene { width:60%; } .tekst { max-width:42%; } }
  `;

  // Model Y (2025, «Juniper») sett fra venstre side, fronten mot venstre. Bakken ligger på y≈157.
  const EIKE = (x) => [0, 72, 144, 216, 288].map((a) => `<path d="M${x} 144.5 q2.2 -3.4 0.6 -8.4 l1.7 0.2 q1.3 5.2 -2.3 8.2z" fill="#4a515b" transform="rotate(${a} ${x} 144.5)"/>`).join("");
  const HJUL = (x) => `<g><circle class="dekk" cx="${x}" cy="144.5" r="12.8"/><circle class="felg" cx="${x}" cy="144.5" r="9.3"/>
      <g class="eiker"><circle cx="${x}" cy="144.5" r="9.3" fill="none"/>${EIKE(x)}</g>
      <circle class="nav" cx="${x}" cy="144.5" r="2"/></g>`;
  const KAROSSERI = "M11.5 148.6 L9.7 139 Q9.2 131 12.3 127.9 Q15 125 20.7 123.3 L55.9 116.1 Q72 104 91.1 99.8 Q112 96.6 143.1 101.9 Q158 104.5 169.9 110.3 L175.2 112.3 Q175.4 116 176 120.7 Q178.6 126 178.3 133.3 L179.1 146.3 L163.3 148.6 A15.3 15.3 0 1 0 133.7 148.6 L53.1 148.6 A15.3 15.3 0 1 0 23.5 148.6 Z";
  const SVG = `<svg viewBox="0 0 200 180" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
    <defs>
      <linearGradient id="glitter" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <linearGradient id="lakkskygge" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".26"/><stop offset=".3" stop-color="#fff" stop-opacity=".05"/>
        <stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient>
      <linearGradient id="lakkside" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity=".18"/><stop offset=".35" stop-color="#fff" stop-opacity=".08"/>
        <stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>
      <linearGradient id="frontrute" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#55606c"/><stop offset="1" stop-color="#262d35"/></linearGradient>
      <linearGradient id="bakrute" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b2027"/><stop offset=".6" stop-color="#0f1216"/><stop offset="1" stop-color="#1d2229"/></linearGradient>
      <clipPath id="terskelklipp"><rect x="56" y="145.6" width="76" height="3.6" rx="1.8"/></clipPath>
    </defs>
    <line class="vei" x1="0" y1="157.5" x2="200" y2="157.5"/>
    <line class="veistriper" x1="0" y1="166" x2="200" y2="166"/>
    <line class="fartlinjer" x1="180" y1="126" x2="192" y2="126"/><line class="fartlinjer fl2" x1="182" y1="134" x2="196" y2="134"/><line class="fartlinjer fl3" x1="180" y1="142" x2="190" y2="142"/>
    <ellipse class="skygge" cx="95" cy="157.5" rx="88" ry="4.5"/>

    <!-- lader på veggen og kabel -->
    <rect class="boks" x="186" y="98" width="12" height="24" rx="4"/><circle class="boks-led" cx="192" cy="104" r="1.7"/>
    <path class="kabel" d="M192 122 C192 150, 183 154, 180 140 S176.5 122 172.5 119.5"/>
    <path class="energi" d="M192 122 C192 150, 183 154, 180 140 S176.5 122 172.5 119.5"/>

    <!-- låseikon over taket -->
    <g transform="translate(112 84)"><g class="laas">
      <circle class="laas-sirkel" cx="0" cy="0" r="8"/>
      <path class="laas-bue" d="M-2.6 -1 v-2.2 a2.6 2.6 0 0 1 5.2 0 v2.2"/>
      <rect class="laas-kropp" x="-3.8" y="-1" width="7.6" height="5.6" rx="1.2"/>
    </g></g>

    <!-- bakluke: tegnes før karosseriet så den ligger bak når den åpnes -->
    <g class="lokk bak">
      <path class="karosseri" d="M143.1 101.9 Q158 104.5 169.9 110.3 L175.2 112.3 L176 120.7 L168.5 119.4 Q160 110 143.1 105.6 Z"/>
      <path d="M143.1 101.9 Q158 104.5 169.9 110.3 L175.2 112.3 L176 120.7 L168.5 119.4 Q160 110 143.1 105.6 Z" fill="url(#lakkskygge)"/>
      <path d="M145 103.3 Q156 105.6 164 110.2 L160.5 110.8 Q153 107 144.5 105Z" fill="#12161b"/>
    </g>

    <!-- karosseri med lakk og skygge -->
    <path class="karosseri" d="${KAROSSERI}"/>
    <path d="${KAROSSERI}" fill="url(#lakkside)"/>
    <path d="${KAROSSERI}" fill="url(#lakkskygge)"/>
    <!-- svarte hjulbuer, terskel og støtfangere -->
    <path d="M53.1 148.6 A15.3 15.3 0 1 0 23.5 148.6" fill="none" stroke="#15181c" stroke-width="2.4"/>
    <path d="M163.3 148.6 A15.3 15.3 0 1 0 133.7 148.6" fill="none" stroke="#15181c" stroke-width="2.4"/>
    <path d="M11.2 146 Q16 147.6 22.8 147.4 L22.8 149.6 Q15 150 11.6 148.6Z" fill="#15181c"/>
    <path d="M164.8 142.6 L179.3 141.4 L179.1 146.3 L164.5 148.4Z" fill="#15181c"/>
    <path d="M11.2 134.4 Q15 133.6 19.5 133.8 L19.2 135.6 Q15 135.6 11.4 136.2Z" fill="#15181c"/>
    <!-- vinduer -->
    <path d="M63.6 117 Q76 105 91 100.4 Q118 97.5 143 102.4 Q150 104 155 107.2 Q153 110.5 151.5 112.9 L63.6 117.2 Z" fill="#0d1014"/>
    <path d="M65.5 116.4 Q77 105.8 91.5 101.6 L102.8 101 L102.8 115.8 Z" fill="url(#frontrute)"/>
    <path d="M109 100.8 Q127 100.6 141.5 103.3 L141.5 113.6 L109 115.4 Z" fill="url(#bakrute)"/>
    <path d="M144 103.8 Q150 105 153.2 107.6 Q151.8 110.4 150.4 112.2 L144 113.2 Z" fill="url(#bakrute)"/>
    <path d="M67 115 Q76 107 88 103" fill="none" stroke="rgba(255,255,255,.18)" stroke-width=".8"/>
    <!-- vinduer på gløtt -->
    <path class="glipe" d="M67 115.2 Q77.5 105.8 91.6 102 L102.4 101.4"/>
    <path class="glipe" d="M109.4 101.4 Q127 101.2 141.2 104"/>
    <path class="glipe" d="M144.4 104.4 Q149.8 105.6 152.6 108"/>
    <path class="luft" d="M84 101 q1.5-2 0-4 q-1.5-2 0-4"/><path class="luft l2" d="M121 99.5 q1.5-2 0-4 q-1.5-2 0-4"/><path class="luft l3" d="M138 101 q1.5-2 0-4 q-1.5-2 0-4"/>
    <!-- detaljer: dørlinjer, håndtak, speil, kamera, skulderlinje -->
    <path class="linje" d="M58.2 118.9 Q55.4 132 57.6 147 M102.8 117.2 V146.4 M143.1 114.2 Q141.4 124 136.4 131.5"/>
    <path d="M58 124.8 Q115 120.4 176.4 120" fill="none" stroke="rgba(255,255,255,.22)" stroke-width=".9"/>
    <rect x="92.6" y="120.6" width="7.8" height="1.5" rx=".75" fill="rgba(0,0,0,.45)"/>
    <rect x="131.6" y="118.4" width="7.8" height="1.5" rx=".75" fill="rgba(0,0,0,.45)"/>
    <path d="M64.3 117.9 Q64.3 113.4 69.4 112.7 Q72.9 113 72.7 115.8 L68.4 118.4 Z" class="karosseri"/>
    <path d="M64.3 117.9 Q64.3 113.4 69.4 112.7 Q72.9 113 72.7 115.8 L68.4 118.4 Z" fill="rgba(0,0,0,.22)"/>
    <path d="M49.8 125.8 L55.9 125.5 L53 127.3 Z" fill="#101316"/>
    <circle class="sentrylys" cx="53" cy="126.2" r="1.5"/>
    <!-- lys -->
    <path class="lys" d="M11.5 128.6 Q16 126.6 24 126.2 L23.5 127.4 Q17 128 12 129.8 Z"/>
    <path d="M165.3 116.2 Q171 115.6 176.3 118.2 L176 121.4 Q170 120.2 165.6 118.6 Z" fill="#170d0d"/>
    <path class="baklys" d="M166 117.4 Q171 117.2 176 119.6" fill="none" stroke-width="1.1"/>
    <circle class="port" cx="172.3" cy="119.2" r="1.6"/>
    <g class="portluke"><rect class="karosseri" x="170.3" y="117.3" width="4.2" height="3.8" rx="1"/><rect x="170.3" y="117.3" width="4.2" height="3.8" rx="1" fill="rgba(0,0,0,.28)"/></g>
    <text class="t-inne" x="125" y="110.5" text-anchor="middle"></text>

    <!-- frunk (panser) -->
    <g class="lokk frunk">
      <path class="karosseri" d="M20.7 123.3 L55.9 116.1 L57 119.2 L21.8 126.6 Z"/>
      <path d="M20.7 123.3 L55.9 116.1 L57 119.2 L21.8 126.6 Z" fill="rgba(255,255,255,.2)"/>
    </g>

    <!-- defrost på frontruta -->
    <path class="dfr" d="M72 114.5 q1.5-2 0-4 q-1.5-2 0-4"/><path class="dfr d2" d="M79 112 q1.5-2 0-4 q-1.5-2 0-4"/><path class="dfr d3" d="M86 109.5 q1.5-2 0-4 q-1.5-2 0-4"/>

    <!-- batteriet i den svarte terskelen mellom hjulene -->
    <rect x="54" y="144.4" width="80" height="6" rx="2" fill="#15181c"/>
    <rect class="terskel" x="56" y="145.6" width="76" height="3.6" rx="1.8"/>
    <g clip-path="url(#terskelklipp)">
      <rect class="celle" x="56" y="145.6" width="0" height="3.6" fill="#5be38a"/>
      <rect class="glitter" x="56" y="145.6" width="24" height="3.6"/>
    </g>
    <line class="grense" x1="0" y1="143" x2="0" y2="152"/>

    <!-- hjul -->
    ${HJUL(38.3)}${HJUL(148.5)}
  </svg>`;

  class MshTeslaScene extends HTMLElement {
    static getStubConfig() { return {}; }
    static getConfigForm() {
      return {
        schema: [
          { name: "navn", selector: { text: {} } },
          { name: "lakk", selector: { text: {} } },
          { name: "kapasitet", selector: { number: { min: 40, max: 110, unit_of_measurement: "kWh" } } },
          { name: "batteri", selector: { entity: { domain: "sensor" } } },
          { name: "rekkevidde", selector: { entity: { domain: "sensor" } } },
          { name: "effekt", selector: { entity: { domain: "sensor" } } },
          { name: "ladegrense", selector: { entity: {} } },
          { name: "ladestatus", selector: { entity: {} } },
          { name: "ladeport", selector: { entity: {} } },
          { name: "fart", selector: { entity: { domain: "sensor" } } },
          { name: "vindu", selector: { entity: { domain: "switch" } } },
          { name: "laas", selector: { entity: { domain: ["lock", "switch", "binary_sensor"] } } },
          { name: "laas_omvendt", selector: { boolean: {} } },
          { name: "bagasje", selector: { entity: { domain: ["switch", "cover"] } } },
          { name: "frunk", selector: { entity: { domain: ["switch", "cover"] } } },
          { name: "tap_action", selector: { ui_action: {} } },
        ],
        computeLabel: (s) => ({ navn: "Navn", lakk: "Lakkfarge (hex)", kapasitet: "Batterikapasitet", batteri: "Batterinivå", rekkevidde: "Rekkevidde",
          effekt: "Ladeeffekt", ladegrense: "Ladegrense", ladestatus: "Ladestatus", ladeport: "Ladeport", fart: "Fart", vindu: "Vinduer på gløtt", laas: "Lås", laas_omvendt: "Lås: «på» betyr åpen", bagasje: "Bagasjerom", frunk: "Frunk", tap_action: "Trykk" }[s.name] || s.name),
      };
    }
    setConfig(c) { this._c = { ...STANDARD, ...(c || {}) }; this._auto = null; this._bygget = false; if (this._hass) this._oppdater(); }
    set hass(h) {
      this._hass = h; if (!this._c) return;
      if (!this._auto || Date.now() - this._autoTid > 60000) this._finn();
      const ids = this._ids || [];
      if (this._bygget && this._siste && ids.every((id, i) => h.states[id] === this._siste[i])) return;
      this._siste = ids.map((id) => h.states[id]); this._oppdater();
    }
    getCardSize() { return 4; }
    getGridOptions() { return { columns: 12, rows: 3, min_rows: 3 }; }

    /** fyll inn manglende entiteter automatisk ut fra prefiksene */
    _finn() {
      const c = this._c, h = this._hass, pre = [].concat(c.prefiks || []);
      const kandidater = Object.keys(h.states).filter((id) => pre.some((p) => id.includes(p)));
      const a = {};
      for (const [k, mønstre] of Object.entries(AUTO)) {
        if (c[k] && h.states[c[k]]) { a[k] = c[k]; continue; }
        a[k] = kandidater.find((id) => mønstre.some((m) => m.test(id)));
      }
      for (const k of ["batteri", "rekkevidde", "effekt", "ladestatus", "ladeport", "lader", "ladegrense", "laas", "bagasje", "defrost", "vindu"]) a[k] = c[k];
      if (a.bagasje && a.frunk === a.bagasje) a.frunk = null;
      this._auto = a; this._autoTid = Date.now();
      this._ids = Object.values(a).flat().filter(Boolean);
    }
    _mer(id) { if (id) this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true })); }
    _trykk() {
      const a = this._c.tap_action || { action: "more-info" };
      if (a.action === "none") return;
      if (a.action === "navigate" && a.navigation_path) { history.pushState(null, "", a.navigation_path); window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } })); }
      else if (a.action === "more-info") this._mer(a.entity || this._auto.batteri);
      else this.dispatchEvent(new CustomEvent("hass-action", { detail: { config: { tap_action: a, entity: this._auto.batteri }, action: "tap" }, bubbles: true, composed: true }));
      navigator.vibrate && navigator.vibrate(10);
    }
    _bygg() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `<style>${STIL}</style><div class="tc" role="button" tabindex="0">
        <div class="glod"></div><div class="tekst"><div class="n"></div><span class="pille"><span class="pt"></span></span>
        <div class="stor"></div><div class="sub"></div></div><div class="scene">${SVG}</div></div>`;
      const kort = this.shadowRoot.querySelector(".tc");
      kort.addEventListener("click", () => this._trykk());
      kort.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this._trykk(); } });
      this._bygget = true;
    }

    _oppdater() {
      if (!this._bygget) this._bygg();
      if (!this._auto) this._finn();
      const a = this._auto, c = this._c, h = this._hass, s = (id) => (id ? h.states[id] : undefined);
      const $ = (q) => this.shadowRoot.querySelector(q), kort = $(".tc");
      kort.style.setProperty("--lakk", c.lakk);

      const batt = tall(s(a.batteri)), rekk = tall(s(a.rekkevidde)), grense = tall(s(a.ladegrense));
      let eff = tall(s(a.effekt)); if (!isNaN(eff) && s(a.effekt).attributes.unit_of_measurement === "W") eff /= 1000;
      const lsSt = ok(s(a.ladestatus)) ? String(s(a.ladestatus).state).toLowerCase() : "";
      // ladestatus: charging/starting = lader, complete/stopped/no_power/plugged = tilkoblet, disconnected = frakoblet
      const lader = ((/charging|starting|lader/.test(lsSt)) && !/not|complete|stopped|disconnected/.test(lsSt)) || (s(a.lader) && s(a.lader).state === "on") || eff > 0.3;
      const tilkoblet = lader || (/plugged|connected|complete|stopped|no_power|nopower|fullført|stoppet/.test(lsSt) && !/disconnected|unplugged|frakoblet/.test(lsSt)) || (s(a.kabel) && s(a.kabel).state === "on");
      const portApen = tilkoblet || (s(a.ladeport) && ["on", "open"].includes(s(a.ladeport).state));
      const gir = ok(s(a.gir)) ? String(s(a.gir).state).toUpperCase() : "";
      let fart = tall(s(a.fart));
      if (!isNaN(fart) && /mph|mi\/h/i.test(String(s(a.fart).attributes.unit_of_measurement || ""))) fart *= 1.609;
      const kjorer = fart > 0.5 || ["D", "R"].includes(gir);
      /* Tre former i praksis:
         · `lock.` gir "locked" / "unlocked"
         · en bryter der `on` betyr LÅST
         · en bryter der `on` betyr ÅPEN (Tesla-brua, `doors_locked`)
         Den siste kan ikke utledes fra navnet, så `laas_omvendt` avgjør.
         Ukjent verdi regnes som låst: å vippe på låseikonet fordi en entitet ikke
         svarer, ville vært en påstand uten dekning. */
      const laasSt = s(a.laas) && s(a.laas).state;
      const ulast = laasSt === "unlocked" ? true
        : laasSt === "locked" ? false
        : laasSt === "on" ? c.laas_omvendt !== false
        : laasSt === "off" ? c.laas_omvendt === false
        : false;
      // bryter (on = åpen) eller cover (open/opening)
      const apen = (x) => !!x && ["open", "opening", "on"].includes(x.state);
      const bakApen = apen(s(a.bagasje)), frunkApen = apen(s(a.frunk));
      const defrost = [].concat(a.defrost || []).some((id) => s(id) && s(id).state === "on");
      const vindu = apen(s(a.vindu));
      const sentry = s(a.sentry) && s(a.sentry).state === "on";
      const lavt = batt < 20 && !lader;

      const kl = { lader, tilkoblet, kjorer, ulast, "port-apen": portApen, "bak-apen": bakApen, "frunk-apen": frunkApen, defrost, vindu, sentry, lavt: lavt && !kjorer };
      for (const [k, v] of Object.entries(kl)) kort.classList.toggle(k, !!v);
      kort.style.setProperty("--flyt", (isNaN(eff) ? 1 : klem(1.3 - eff / 20, 0.3, 1.3)).toFixed(2) + "s");
      const f = isNaN(fart) ? 40 : klem(fart, 5, 130);
      kort.style.setProperty("--hjul", (18 / f).toFixed(3) + "s");   // 50 km/t ≈ 0,36 s per omdreining
      kort.style.setProperty("--vei", (36 / f).toFixed(3) + "s");

      // batteri i terskelen + ladegrense-markør
      const b = isNaN(batt) ? 0 : klem(batt, 0, 100);
      const celle = $(".celle");
      celle.setAttribute("width", (b / 100 * 76).toFixed(1));
      celle.setAttribute("fill", lader ? "#5ae6a0" : b < 20 ? "#ff5a4a" : b < 31 ? "#ffb34a" : "#5be38a");
      const gl = $(".grense");
      if (isNaN(grense)) gl.style.display = "none"; else { gl.style.display = ""; gl.style.transform = `translateX(${(56 + klem(grense, 0, 100) / 100 * 76).toFixed(1)}px)`; }
      const inne = tall(s(a.innetemp)), klimaPaa = s(a.klima) && s(a.klima).state !== "off" && ok(s(a.klima));
      $(".t-inne").textContent = !isNaN(inne) && (klimaPaa || kjorer) ? `${Math.round(inne)}°` : "";

      // tekst
      $(".n").textContent = c.navn;
      let pt, ik, farge = "";
      if (kjorer) { pt = !isNaN(fart) && fart > 0.5 ? `Kjører · ${Math.round(fart)} km/t` : "Kjører"; ik = "mdi:steering"; }
      else if (lader) { pt = isNaN(eff) ? "Lader" : `Lader · ${komma(eff, 1)} kW`; ik = "mdi:ev-station"; }
      else if (bakApen || frunkApen) { pt = frunkApen && bakApen ? "Frunk og bagasjerom åpne" : frunkApen ? "Frunken er åpen" : "Bagasjerommet er åpent"; ik = "mdi:car-back"; farge = "gul"; }
      else if (ulast) { pt = "Ulåst"; ik = "mdi:lock-open-variant"; farge = "gul"; }
      else if (vindu) { pt = "Vinduer på gløtt"; ik = "mdi:car-door"; farge = "gul"; }
      else if (lavt) { pt = "Lavt batteri"; ik = "mdi:battery-alert-variant-outline"; farge = "rod"; }
      else if (tilkoblet) { pt = /complete|fullført/.test(lsSt) ? "Ferdig ladet" : "Tilkoblet"; ik = "mdi:power-plug"; }
      else if (portApen) { pt = "Ladeport åpen"; ik = "mdi:ev-plug-type2"; }
      else if (sentry) { pt = "Sentry på"; ik = "mdi:cctv"; }
      else { pt = "Låst"; ik = "mdi:lock"; }
      const pille = $(".pille"); pille.className = "pille " + farge;
      pille.dataset.ikon = ik; $(".pt").textContent = pt; // Fiks 26.10: ingen ikon i chippen (ikonnavnet beholdes som data)
      $(".stor").innerHTML = isNaN(batt) ? "--" : `${Math.round(batt)}<small>%</small>`;

      const deler = [];
      if (!isNaN(rekk)) deler.push(`${Math.round(rekk)} km`);
      if (lader && !isNaN(eff) && eff > 0.3 && !isNaN(grense) && !isNaN(batt) && grense > batt) {
        const timer = ((grense - batt) / 100) * c.kapasitet / eff;
        const ferdig = new Date(Date.now() + timer * 3600000);
        deler.push(`${Math.round(grense)} % ca ${ferdig.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}`);
      } else if (!isNaN(grense)) deler.push(`grense ${Math.round(grense)} %`);
      $(".sub").textContent = deler.join("  ·  ");
      kort.setAttribute("aria-label", `${c.navn}: ${pt}. Batteri ${$(".stor").textContent}. ${$(".sub").textContent}`);
    }
  }

  if (!customElements.get("msh-tesla-scene")) customElements.define("msh-tesla-scene", MshTeslaScene);
})();

/* ================================================================ del 2 · Tesla-popupen (msh-tesla-card) */
(function () {
  const M = window.MSH;
  if (!M || customElements.get('msh-tesla-card')) return;
  const esc = M.esc, C = M.C;
  const HASH = '#tesla';
  const PINK = C.pink, ACC = C.accent, INK = '#2a1720', ORANGE = C.orange, GREEN = C.green, BLUE = C.blue;
  const DAY = 86400000, TTL = 300000;
  // Standard prefikser (fasit: ki-tesla-card STANDARD.prefiks) + «tesla». Bare entiteter som FINNES i HA velges.
  const DEF_PREFIX = ['tesla_model_y', 'folkevogn', 'tesla'];
  const PLATFORMS = ['tesla', 'tesla_custom', 'tesla_fleet', 'teslemetry', 'tessie'];
  const CHARGER_RX = /elbillader|easee|zaptec|wallbox|go_?e_?charger|ctek|charge_?amps|garo/;
  const PAINTS = [['#7b92ac', 'Blågrå'], ['#e9e9e7', 'Perlehvit'], ['#1c1d20', 'Svart'], ['#7d8084', 'Stealth-grå'], ['#a3161f', 'Ultrarød'], ['#233f8c', 'Dyphavsblå']];
  const TABS = [['lading', 'Lading', 'mdi:ev-station'], ['kjoring', 'Kjøring', 'mdi:steering'], ['sparing', 'Sparing', 'mdi:piggy-bank']];
  const TABL = Object.fromEntries(TABS.map((t) => [t[0], t]));
  // Fiks 26.10: riktige ikoner (lås/lås opp, horn, defrost, frunk = car-select, bagasje = bag-suitcase) – ikke to bilikoner
  const BTNS = [['lock', 'Lås', 'mdi:lock'], ['honk', 'Tut', 'mdi:bullhorn'], ['defrost', 'Defrost', 'mdi:car-defrost-front'], ['frunk', 'Frunk', 'mdi:car-select'], ['trunk', 'Bagasje', 'mdi:bag-suitcase']];
  const CONF_DEF = { lock: true, honk: false, defrost: false, frunk: true, trunk: true };
  const LIMIT_OPTS = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
  const DEF = { name: 'Tesla Model Y', paint: '#7b92ac', capacity: 75, button_text: true, smart_until: 7, lock_inverted: true, confirm: false, limits: [50, 60, 70, 80, 100] };
  const TABS_DEF = { style: 'filled', content: 'text', start: 'lading' };
  const GROUPS = [['lading', 'Batteri og lading', 'mdi:battery-charging-high'], ['status', 'Kjøring og status', 'mdi:car-info'], ['sparing', 'Sparing', 'mdi:piggy-bank-outline']];
  /* Entitetsfelt: [nøkkel, navn, gruppe, domener, mønstre (første mønster med treff vinner), familie, ikon]
     familie: car = prefiks/Tesla-plattform (+ sensor.ki_tesla_*), charger = car + laderen (elbillader/Easee/Zaptec …),
     ki = KI Drivstoff (sensor.ki_drivstoff_*), price = strømpris (felles kilde, 15-strompris-kilde.js). */
  const FIELDS = [
    ['battery', 'Batterinivå', 'lading', ['sensor'], [/batteri_?niva|battery_level|state_of_charge|_soc$/, /_batteri$|_battery$/], 'car', 'mdi:battery'],
    ['range', 'Rekkevidde', 'lading', ['sensor'], [/batterirekkevidde|battery_range|rekkevidde|_range$/], 'car', 'mdi:road-variant'],
    ['charge_power', 'Ladeeffekt', 'lading', ['sensor'], [/charge_power|charger_power|charging_power|ladeeffekt/], 'charger', 'mdi:flash'],
    ['charging_state', 'Ladestatus', 'lading', ['select', 'sensor'], [/charging_state|charge_state|ladestatus/], 'car', 'mdi:ev-plug-type2'],
    ['charge_port', 'Ladeport', 'lading', ['switch', 'cover'], [/charg(e|ing)_port|ladeport/], 'car', 'mdi:ev-plug-type2'],
    ['charge_cable', 'Ladekabel', 'lading', ['binary_sensor'], [/charge_cable|ladekabel|plugged|tilkoblet/], 'car', 'mdi:power-plug'],
    ['charger', 'Lader (start/stopp)', 'lading', ['switch'], [/elbillader.*charg|charger_?(enabled|switch)?$|_charg(e|ing)$|_lading$/], 'charger', 'mdi:ev-station'],
    ['charge_limit', 'Ladegrense', 'lading', ['input_number', 'number'], [/ladegrense|charge_limit|charging_limit/], 'car', 'mdi:battery-charging-80'],
    ['time_left', 'Tid til grense', 'lading', ['sensor'], [/ladetid_gjenstaende|time_to_full|time_charge_complete/], 'car', 'mdi:timer-outline'],
    ['charge_cost', 'Pris for ladingen', 'lading', ['sensor'], [/ladepris_estimat|charge_cost_estimate/], 'car', 'mdi:cash'],
    ['last_charge', 'Sist lading', 'lading', ['sensor'], [/forrige_lading_kostnad|last_charge_cost/], 'car', 'mdi:cash-check'],
    ['smart', 'Smartlading (bryter)', 'lading', ['input_boolean', 'switch'], [/smart_?lad|smart_?charg/], 'car', 'mdi:clock-outline'],
    ['price', 'Strømpris (smartlading)', 'lading', ['sensor'], null, 'price', 'mdi:chart-bar'],
    ['lock', 'Lås', 'status', ['lock', 'switch', 'binary_sensor'], [/doors?_lock|_lock$|_locked$|laas|_las$/], 'car', 'mdi:lock'],
    ['honk', 'Tut', 'status', ['button'], [/honk|horn|_tut$/], 'car', 'mdi:bullhorn'],
    ['defrost', 'Defrost', 'status', ['switch'], [/defrost|avising/], 'car', 'mdi:car-defrost-front'],
    ['frunk', 'Frunk', 'status', ['switch', 'cover'], [/frunk|trunk_front|front_trunk|vehicle_state_ft/], 'car', 'mdi:car-select'],
    ['trunk', 'Bagasjerom', 'status', ['switch', 'cover'], [/trunk_rear|rear_trunk|bagasje|liftgate|_trunk$|vehicle_state_rt/], 'car', 'mdi:bag-suitcase'],
    ['window', 'Vinduer', 'status', ['switch', 'cover'], [/window_vent|vindu|windows/], 'car', 'mdi:car-door'],
    ['sentry', 'Sentry', 'status', ['switch'], [/sentry/], 'car', 'mdi:cctv'],
    ['climate', 'Klima', 'status', ['climate'], [/./], 'car', 'mdi:thermostat'],
    ['inside_temp', 'Innetemperatur', 'status', ['sensor'], [/inside_temp|innetemp|inne_temp|interior/], 'car', 'mdi:thermometer'],
    ['shift', 'Gir', 'status', ['sensor'], [/shift_state|_gir$|gear/], 'car', 'mdi:car-shift-pattern'],
    ['speed', 'Fart', 'status', ['sensor'], [/speed$|fart$|hastighet$/], 'car', 'mdi:speedometer'],
    ['odometer', 'Kilometerstand', 'status', ['sensor'], [/kilometerteller|odometer|kilometerstand/], 'car', 'mdi:counter'],
    ['daily', 'Daglig kjøring', 'status', ['sensor'], [/daglig_kjoring|daily_distance|daily_driv|daglig/], 'car', 'mdi:chart-bar'],
    ['saved_month', 'Spart denne måneden', 'sparing', ['sensor'], [/spart_denne_maneden|saved_this_month/], 'ki', 'mdi:piggy-bank'],
    ['saved_year', 'Spart i år', 'sparing', ['sensor'], [/(^|drivstoff_)spart_i_ar$|saved_this_year/], 'ki', 'mdi:piggy-bank-outline'],
    ['cost_ev', 'Kostnad per mil – elbil', 'sparing', ['sensor'], 'ev', 'ki', 'mdi:car-electric'],
    ['cost_diesel', 'Kostnad per mil – diesel', 'sparing', ['sensor'], 'diesel', 'ki', 'mdi:car-estate'],
    ['diesel_liters', 'Liter diesel spart', 'sparing', ['sensor'], [/liter_diesel_spart/], 'ki', 'mdi:fuel'],
    ['co2', 'CO₂ spart', 'sparing', ['sensor'], [/co2_spart/], 'ki', 'mdi:molecule-co2'],
    ['diesel_price', 'Dieselpris', 'sparing', ['sensor'], [/dieselpris|diesel_price/], 'ki', 'mdi:gas-station'],
    ['charge_price', 'Ladepris (strøm)', 'sparing', ['sensor'], [/_ladepris$|charge_price$/], 'ki', 'mdi:ev-station'],
  ];
  const FL = Object.fromEntries(FIELDS.map((f) => [f[0], f]));
  const BAD = ['unavailable', 'unknown', '', 'none'];
  const okS = (s) => !!s && !BAD.includes(String(s.state));
  const numS = (s) => { if (!okS(s)) return null; const v = parseFloat(String(s.state).replace(',', '.')); return isNaN(v) ? null : v; };
  const obj = (id) => String(id || '').split('.')[1] || '';
  const d0 = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); if (n) d.setDate(d.getDate() + n); return d; };
  const dk = (d) => `${d.getFullYear()}-${M.pad(d.getMonth() + 1)}-${M.pad(d.getDate())}`;
  const UKE = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
  const kr = (v, d = 0) => (v == null ? '–' : M.nf(v, d) + ' kr');

  /* ------------------------------------------------------------ config-hjelpere */
  const prefixes = (c) => { const p = c && c.prefix; const L = (Array.isArray(p) ? p : String(p || '').split(',')).map((x) => String(x).trim().toLowerCase()).filter(Boolean); return L.length ? L : DEF_PREFIX; };
  const tabsCfg = (c) => ({ ...TABS_DEF, ...((c && c.tabs) || {}) });
  const tabOrder = (c) => { const k = TABS.map((t) => t[0]); const o = (Array.isArray(tabsCfg(c).order) ? tabsCfg(c).order : []).filter((x) => k.includes(x)); k.forEach((x) => { if (!o.includes(x)) o.push(x); }); return o; };
  const tabHidden = (c) => new Set(Array.isArray(tabsCfg(c).hidden) ? tabsCfg(c).hidden : []);
  const visTabs = (c) => { const hid = tabHidden(c); const o = tabOrder(c).filter((k) => !hid.has(k)); return o.length ? o : [tabOrder(c)[0]]; };
  const btnCfg = (c, k) => ((c && c.buttons) || {})[k] || {};
  const limitsOf = (c) => { const L = Array.isArray(c.limits) ? c.limits.map(Number).filter((v) => v >= 50 && v <= 100) : DEF.limits; return [...new Set(L)].sort((a, b) => a - b); };
  const paintOf = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c.paint || '').trim()) || /^var\(/.test(String(c.paint || '')) ? String(c.paint).trim() : DEF.paint);

  /* ------------------------------------------------------------ autofunn (prefiks + entiteter.md: domene + mønster) */
  const AUTO = new WeakMap();
  function pools(h, pre) {
    const E = h.entities || {}, car = [], charger = [], ki = [];
    const rank = (id) => { const o = obj(id); const i = pre.findIndex((p) => o.includes(p)); return i < 0 ? pre.length : i; };
    Object.keys(h.states).forEach((id) => {
      const o = obj(id), r = E[id] || {};
      if (r.hidden || r.disabled_by) return;
      const isCar = pre.some((p) => o.includes(p)) || PLATFORMS.includes(r.platform) || o.startsWith('ki_tesla_');
      if (isCar) car.push(id);
      if (isCar || CHARGER_RX.test(o)) charger.push(id);
      if (id.startsWith('sensor.ki_drivstoff_')) ki.push(id);
    });
    const sort = (L) => L.sort((a, b) => rank(a) - rank(b) || a.length - b.length || (a < b ? -1 : 1));
    return { car: sort(car), charger: sort(charger), ki: ki.sort() };
  }
  const isEvCost = (h, id, pre) => { const a = (h.states[id] || {}).attributes || {}; return /kwh/i.test(String(a.forbruk || '')) || pre.some((p) => obj(id).includes(p)) || /tesla|elbil/.test(obj(id)); };
  function autoAll(h, c) {
    if (!h || !h.states) return {};
    const pre = prefixes(c), key = pre.join(','), cache = AUTO.get(h.states);
    if (cache && cache.key === key) return cache.a;
    const P = pools(h, pre), a = {};
    FIELDS.forEach(([k, , , doms, pats, fam]) => {
      if (fam === 'price') { try { a[k] = M.powerPriceAuto && M.powerPriceCfg ? M.powerPriceAuto(h, M.powerPriceCfg()) || null : null; } catch (e) { a[k] = null; } return; }
      const L = (P[fam] || []).filter((id) => doms.includes(id.split('.')[0]));
      if (pats === 'ev' || pats === 'diesel') { const K = L.filter((id) => /kostnad_per_mil/.test(id)); a[k] = K.find((id) => (pats === 'ev') === isEvCost(h, id, pre)) || null; return; }
      let hit = null;
      for (const re of pats) { hit = L.find((id) => re.test(obj(id))); if (hit) break; }
      a[k] = hit || null;
    });
    if (a.trunk && a.trunk === a.frunk) a.trunk = null;
    if (a.charger && a.charger === a.charge_port) a.charger = null;
    AUTO.set(h.states, { key, a });
    return a;
  }
  const entOf = (h, c, k) => { const o = ((c && c.entities) || {})[k]; return o || (autoAll(h, c)[k] || null); };
  M.teslaAuto = autoAll;
  M.teslaEntity = entOf;
  // Vilkår for popupen (#tesla): Tesla-entiteter finnes (batteri, lås, ladegrense eller rekkevidde via prefiks/plattform)
  M.teslaHas = (h) => { if (!h || !h.states) return false; const a = autoAll(h, {}); return !!(a.battery || a.lock || a.charge_limit || a.range); };

  /* ------------------------------------------------------------ tilstand (samme tolkning som bilscenen) */
  function charging(h, c) {
    const S = (k) => { const id = entOf(h, c, k); return id ? h.states[id] : null; };
    let eff = numS(S('charge_power'));
    if (eff != null && /^w$/i.test(String((S('charge_power').attributes || {}).unit_of_measurement || ''))) eff /= 1000;
    const ls = okS(S('charging_state')) ? String(S('charging_state').state).toLowerCase() : '';
    const sw = S('charger');
    const lader = (/charging|starting|lader/.test(ls) && !/not|complete|stopped|disconnected/.test(ls)) || (sw && sw.state === 'on') || (eff != null && eff > 0.3);
    const tilkoblet = lader || (/plugged|connected|complete|stopped|no_power|nopower|fullført|stoppet/.test(ls) && !/disconnected|unplugged|frakoblet/.test(ls)) || (S('charge_cable') && S('charge_cable').state === 'on');
    return { eff, ls, lader: !!lader, tilkoblet: !!tilkoblet, ferdig: /complete|fullført/.test(ls) };
  }
  function unlocked(h, c) {
    const id = entOf(h, c, 'lock'), st = id && h.states[id] && h.states[id].state;
    const inv = c.lock_inverted !== false;
    return st === 'unlocked' ? true : st === 'locked' ? false : st === 'on' ? inv : st === 'off' ? !inv : false;
  }
  const isOpen = (s) => !!s && ['open', 'opening', 'on'].includes(s.state);

  /* ------------------------------------------------------------ statistikk (kun når popupen er åpen, cache 5 min) */
  const STAT = new Map();
  async function dayStats(h, id, days) {
    const k = id + '|' + days, x = STAT.get(k);
    if (x && Date.now() - x.t < TTL) return x.d;
    const s = d0(-(days - 1)), e = new Date(), out = new Map();
    try {
      const r = await h.callWS({ type: 'recorder/statistics_during_period', start_time: s.toISOString(), end_time: e.toISOString(), statistic_ids: [id], period: 'day', types: ['max', 'change'] });
      ((r && r[id]) || []).forEach((p) => { const t = new Date(typeof p.start === 'number' ? p.start : p.start); out.set(dk(t), { max: p.max != null ? Number(p.max) : null, change: p.change != null ? Number(p.change) : null }); });
    } catch (err) { /* ingen statistikk */ }
    if (!out.size && M.history) { // reserve: rå historikk, største/siste verdi per dag
      try {
        const H = await M.history(h, [id], days * 24);
        (H[id] || []).forEach((p) => { const key = dk(new Date(p.t)), o = out.get(key) || { max: null, last: null }; o.max = o.max == null ? p.v : Math.max(o.max, p.v); o.last = p.v; o.change = null; out.set(key, o); });
      } catch (err) { /* */ }
    }
    STAT.set(k, { t: Date.now(), d: out });
    return out;
  }

  /* ------------------------------------------------------------ bekreftelse (portalt, fallgruve 1) */
  function confirmDlg(title, okLabel, run) {
    const ov = M.overlay({ center: true, maxWidth: 340, guard: 250, css: `.cf{display:flex;flex-direction:column;gap:16px;padding:8px 4px 4px}.cf h3{margin:0;font-size:18px;font-weight:500;text-align:center;color:#fafafa}
      .cf .b{display:flex;gap:8px}.cf button{flex:1;height:48px;border-radius:24px;background:#404040;color:#fafafa;font:inherit;font-size:15px;font-weight:500;border:0;cursor:pointer}.cf button.ok{background:${ACC};color:${INK}}`,
    html: `<div class="cf" role="alertdialog"><h3>${esc(title)}</h3><div class="b"><button data-k="no">Avbryt</button><button class="ok" data-k="ok">${esc(okLabel)}</button></div></div>` });
    ov.root.addEventListener('click', (e) => {
      const b = e.composedPath().find((n) => n.dataset && n.dataset.k);
      if (!b) return;
      M.haptic(b.dataset.k === 'ok' ? 'success' : 'light');
      ov.close();
      if (b.dataset.k === 'ok') run();
    });
    return ov;
  }

  /* ------------------------------------------------------------ fanelinjen (kortet + live forhåndsvisning i «Tilpass Tesla») */
  function tabBtn(c, k, on, attrs) {
    const [, label, icon] = TABL[k], T = tabsCfg(c), mode = T.content;
    const showIcon = mode !== 'text', showLabel = mode === 'text' || mode === 'both' || (mode === 'icon_active' && on);
    const fill = T.style !== 'outline';
    const st = on ? (fill ? `background:${ACC};color:${INK}` : `background:transparent;color:${PINK};box-shadow:inset 0 0 0 1.5px ${PINK}`) : 'background:transparent;color:var(--gray800,#afafaf)';
    return `<button class="tab${on ? ' on' : ''}${showLabel ? '' : ' io'}" role="tab" aria-selected="${on}" aria-label="${esc(label)}" title="${esc(label)}" ${attrs || ''} style="${st}">${showIcon ? M.icon(icon, 20) : ''}${showLabel ? `<span>${esc(label)}</span>` : ''}</button>`;
  }
  // Fiks 26.10: fanelinjen fyller hele bredden ved siden av tannhjulet – like brede faner (grid, minmax(0,1fr)),
  // høyde 48 (padding 4 + boble 40), så den rosa boblen (aktiv fane + MSH.glassMorph) har fanens bredde og posisjon.
  const TAB_CSS = (pre) => `${pre} .trow{display:flex;align-items:center;gap:8px;min-width:0}
    ${pre} .tbox{flex:1;min-width:0;box-sizing:border-box;height:48px;padding:4px;border-radius:24px;${M.tabSurface ? M.tabSurface('transparent', 'inset 0 0 0 1px rgba(255,255,255,0.12)') : 'background:transparent;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.12);'}overflow:hidden}
    ${pre} .tabs{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:2px;border-radius:20px;overflow:hidden;-webkit-mask-image:none;mask-image:none}
    ${pre} .tabs>.tab{min-width:0;width:100%}
    ${pre} .tab{height:40px;padding:0 8px;overflow:hidden;text-overflow:ellipsis;border-radius:20px;font-size:14px;font-weight:500;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;transition:background .2s,color .2s}
    ${pre} .tab.io{padding:0 10px}
    ${pre} .gear{width:48px;height:48px;border-radius:24px;flex:none;display:grid;place-items:center;${M.tabSurface ? M.tabSurface('transparent', 'inset 0 0 0 1px rgba(255,255,255,0.12)') : 'background:transparent;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.12);'}color:var(--white,#fafafa);transition:transform .15s cubic-bezier(.34,1.5,.64,1)}
    ${pre} .gear:active{transform:scale(.92)}`;

  /* ------------------------------------------------------------ «Tilpass Tesla»: dra-og-slipp for fanene (fallgruve 2) */
  function installEd(ed) {
    if (!ed || ed.__teslaInst || !ed.shadowRoot) return;
    ed.__teslaInst = true;
    const R = ed.shadowRoot;
    let d = null;
    const hit = (e) => e.target && e.target.closest && e.target.closest('[data-tdrag]');
    R.addEventListener('touchstart', (e) => { if (hit(e)) e.stopPropagation(); }, { passive: true });
    R.addEventListener('touchmove', (e) => { if (d || hit(e)) { e.stopPropagation(); if (d && e.cancelable) e.preventDefault(); } }, { passive: false });
    R.addEventListener('pointerdown', (e) => {
      const hd = hit(e);
      if (!hd || e.button) return;
      const item = hd.closest('[data-tdk]');
      if (!item) return;
      e.stopPropagation(); e.preventDefault();
      try { hd.setPointerCapture(e.pointerId); } catch (x) { /* */ }
      d = { item, list: item.parentElement, id: e.pointerId, y0: e.clientY, ty: 0, start: [...item.parentElement.querySelectorAll(':scope > [data-tdk]')].map((x) => x.dataset.tdk) };
      window.__tabReorder = true;
      Object.assign(item.style, { position: 'relative', zIndex: '3', background: '#404040', boxShadow: '0 10px 24px rgba(0,0,0,.45)', transition: 'none' });
      M.haptic('medium');
    });
    R.addEventListener('pointermove', (e) => {
      if (!d || e.pointerId !== d.id) return;
      e.stopPropagation(); e.preventDefault();
      const rows = [...d.list.querySelectorAll(':scope > [data-tdk]')], i = rows.indexOf(d.item);
      const r = d.item.getBoundingClientRect(), center = r.top - d.ty + r.height / 2 + (e.clientY - d.y0);
      const mid = (el) => { const b = el.getBoundingClientRect(); return b.top + b.height / 2; };
      let swap = null;
      if (rows[i + 1] && center > mid(rows[i + 1])) { swap = rows[i + 1]; d.list.insertBefore(swap, d.item); }
      else if (rows[i - 1] && center < mid(rows[i - 1])) { swap = rows[i - 1]; d.list.insertBefore(d.item, swap); }
      if (swap) { const r2 = d.item.getBoundingClientRect(); d.y0 += (r2.top - r.top); M.haptic('selection'); }
      d.ty = e.clientY - d.y0;
      d.item.style.transform = `translateY(${d.ty}px)`;
    });
    const end = (e) => {
      if (!d || (e && e.pointerId !== d.id)) return;
      const D = d; d = null;
      window.__tabReorder = false;
      Object.assign(D.item.style, { transform: '', position: '', zIndex: '', background: '', boxShadow: '', transition: '' });
      const order = [...D.list.querySelectorAll(':scope > [data-tdk]')].map((x) => x.dataset.tdk);
      M.haptic('light');
      if (order.join() !== D.start.join()) ed._set('tabs.order', order); else ed._render();
    };
    R.addEventListener('pointerup', end);
    R.addEventListener('pointercancel', end);
  }

  function editorSchema(h, c) {
    c = c || {};
    const eye = (key, op, v, hid, label) => `<button data-a="fn" data-k="${key}" data-op="${op}" data-v="${esc(v)}" aria-label="${hid ? 'Vis' : 'Skjul'} ${esc(label)}" style="width:40px;height:40px;border-radius:20px;display:grid;place-items:center;flex:none">${M.icon(hid ? 'mdi:eye-off-outline' : 'mdi:eye-outline', 20, `color:${hid ? '#696969' : '#fafafa'}`)}</button>`;
    // Bil: navn, lakk (6 swatcher + egen hex), batterikapasitet
    const paint = { type: 'html', html: (hh, cc, key) => {
      const cur = paintOf(cc).toLowerCase();
      return `<div class="f"><label>Lakk</label><div style="display:flex;flex-wrap:wrap;gap:10px;padding:2px 0">${PAINTS.map(([hex, n]) => `<button data-a="fn" data-k="${key}" data-op="paint" data-v="${hex}" aria-label="${esc(n)}" title="${esc(n)}" aria-pressed="${cur === hex}" style="width:44px;height:44px;border-radius:22px;background:${hex};box-shadow:${cur === hex ? `0 0 0 3px #282828,0 0 0 5px ${'#f285c9'}` : 'inset 0 0 0 1px rgba(255,255,255,.18)'}"></button>`).join('')}</div></div>`;
    }, click: (dd, ed) => { M.haptic('selection'); ed._set('paint', dd.v === DEF.paint ? undefined : dd.v); } };
    const btnSec = ([k, label, icon]) => ({ type: 'section', label, icon, meta: (hh, cc) => { const b = btnCfg(cc, k); return b.show === false ? 'Skjult' : (b.entity || entOf(hh, cc, k) || 'Mangler entitet'); }, fields: [
      { type: 'boolean', name: `buttons.${k}.show`, label: 'Vis knappen', default: true },
      { type: 'entity', name: `buttons.${k}.entity`, label: 'Entitet', domain: FL[k][3], auto: (hh, cc) => entOf(hh, cc, k) },
      { type: 'boolean', name: `buttons.${k}.confirm`, label: 'Be om bekreftelse', default: CONF_DEF[k] },
    ] });
    // Faner: live forhåndsvisning (med tannhjul) + dra-og-slipp-liste med øye
    const preview = { type: 'html', html: (hh, cc) => {
      const V = visTabs(cc), T = tabsCfg(cc), act = V.includes(T.start) ? T.start : V[0];
      return `<style>${TAB_CSS('.tsp')}.tsp{padding:14px 12px;border-radius:24px;background:#282828}.tsp .tl{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#7f7f7f;margin:0 4px 10px}.tsp .tab,.tsp .gear{pointer-events:none}</style>
        <div class="tsp" data-key="tsp" aria-hidden="true"><div class="tl">Forhåndsvisning</div><div class="trow"><div class="tbox"><div class="tabs">${V.map((k) => tabBtn(cc, k, k === act)).join('')}</div></div><span class="gear">${M.icon('mdi:cog', 22)}</span></div></div>`;
    } };
    const order = { type: 'html', html: (hh, cc, key, ed) => {
      installEd(ed);
      const hid = tabHidden(cc);
      return `<div class="f" style="gap:8px;padding:0;background:none;box-shadow:none"><div class="tlist" style="display:flex;flex-direction:column;gap:8px">${tabOrder(cc).map((k) => {
        const [, label, icon] = TABL[k];
        return `<div data-tdk="${k}" data-key="tt-${k}" style="height:56px;border-radius:28px;background:#3a3a3a;display:flex;align-items:center;gap:8px;padding:0 6px 0 4px;${hid.has(k) ? 'opacity:.5' : ''}">
          <span data-tdrag title="Dra for rekkefølge" style="touch-action:none;cursor:grab;display:inline-flex;color:#979797;padding:8px 6px">${M.icon('mdi:drag', 22)}</span>
          <span style="width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:#404040;flex:none">${M.icon(icon, 20)}</span>
          <span style="flex:1;min-width:0;font-size:14px;font-weight:500">${esc(label)}</span>${eye(key, 'eye', k, hid.has(k), label)}</div>`;
      }).join('')}</div><span class="help">Dra i håndtaket for rekkefølge, øyet skjuler. Minst én fane må være synlig.</span></div>`;
    }, click: (dd, ed) => {
      const cc = ed._config || {}, hid = tabHidden(cc);
      if (!hid.has(dd.v) && TABS.filter((t) => !hid.has(t[0])).length <= 1) { M.haptic('warning'); M.toast('Minst én fane må være synlig'); return; }
      if (hid.has(dd.v)) hid.delete(dd.v); else hid.add(dd.v);
      M.haptic('selection'); ed._set('tabs.hidden', hid.size ? [...hid] : undefined);
    } };
    const limits = { type: 'html', html: (hh, cc, key) => {
      const L = limitsOf(cc);
      return `<div class="f"><label>Ladegrense-knapper</label><div class="chips">${LIMIT_OPTS.map((v) => `<button class="chip ${L.includes(v) ? 'on' : ''}" aria-pressed="${L.includes(v)}" data-a="fn" data-k="${key}" data-op="lim" data-v="${v}">${v} %</button>`).join('')}</div><span class="help">Knappene under ladegrense-baren. Dra-baren går alltid fra 50 til 100 %.</span></div>`;
    }, click: (dd, ed) => {
      const L = new Set(limitsOf(ed._config || {})), v = Number(dd.v);
      if (L.has(v)) L.delete(v); else L.add(v);
      M.haptic('selection'); ed._set('limits', [...L].sort((a, b) => a - b));
    } };
    const entSec = ([g, label, icon]) => ({ type: 'section', id: 'ent-' + g, label, icon, meta: (hh, cc) => { const L = FIELDS.filter((f) => f[2] === g); return `${L.filter((f) => entOf(hh, cc, f[0])).length} av ${L.length} funnet`; }, fields: FIELDS.filter((f) => f[2] === g).map(([k, l, , doms, , , ic]) => ({ type: 'entity', name: 'entities.' + k, label: l, icon: ic, domain: doms, auto: (hh, cc) => autoAll(hh, cc)[k] || null, none_label: '– · Velg entitet' })) });
    const reset = { type: 'button', label: 'Tilbakestill til standard', icon: 'mdi:restore', run: (hh, cc, ed) => {
      M.haptic('warning');
      const id = (cc && cc.card_id) || M.uid();
      ed._config = { type: cc.type || 'custom:msh-tesla-card', card_id: id };
      ed._set('card_id', id);
    } };
    return [
      { type: 'tabs', id: 'tesla', tabs: [
        { key: 'bil', label: 'Bil', icon: 'mdi:car-electric', focus: ['bil', 'buttons'], fields: [
          { type: 'section', id: 'bil', label: 'Bil', icon: 'mdi:car-electric', fields: [
            { type: 'text', name: 'name', label: 'Navn', placeholder: DEF.name },
            paint,
            { type: 'text', name: 'paint', label: 'Egen farge (hex)', placeholder: DEF.paint },
            { type: 'range', name: 'capacity', label: 'Batterikapasitet', icon: 'mdi:battery-high', min: 40, max: 110, step: 1, default: DEF.capacity, unit: 'kWh', presets: [[60, '60'], [75, '75'], [82, '82'], [100, '100']] },
          ] },
          { type: 'section', id: 'buttons', label: 'Hurtigknapper', icon: 'mdi:gesture-tap-button', fields: [
            { type: 'boolean', name: 'button_text', label: 'Vis tekst under ikonet', default: true },
            ...BTNS.map(btnSec),
          ] },
        ] },
        { key: 'faner', label: 'Faner', icon: 'mdi:tab', focus: ['faner'], fields: [
          { type: 'section', id: 'faner', label: 'Faner', icon: 'mdi:tab', fields: [
            preview, order,
            { type: 'select', name: 'tabs.style', label: 'Fanestil', options: [['filled', 'Fylt'], ['outline', 'Kontur']], default: 'filled' },
            { type: 'select', name: 'tabs.content', label: 'Faner viser', options: [['text', 'Tekst'], ['icons', 'Ikoner'], ['icon_active', 'Ikon + aktiv'], ['both', 'Begge']], default: 'text' },
            { type: 'select', name: 'tabs.start', label: 'Startfane', options: TABS.map((t) => [t[0], t[1]]), default: 'lading' },
            limits,
          ] },
        ] },
        { key: 'entiteter', label: 'Entiteter', icon: 'mdi:format-list-bulleted-type', focus: ['entiteter', 'ent-lading', 'ent-status', 'ent-sparing'], fields: [
          { type: 'info', label: 'Alt er funnet automatisk via prefikset og Tesla-integrasjonen. Velg en annen entitet bare der det automatiske valget er feil.' },
          ...GROUPS.map(entSec),
        ] },
        { key: 'avansert', label: 'Avansert', icon: 'mdi:tune-variant', focus: ['avansert', 'spacing'], fields: [
          { type: 'section', id: 'avansert', label: 'Avansert', icon: 'mdi:tune-variant', fields: [
            { type: 'boolean', name: 'lock_inverted', label: 'Lås: «på» betyr åpen', default: true, help: 'Tesla-brua (switch …_doors_locked) melder «på» når bilen er ÅPEN. Slå av for en ekte lock.-entitet.' },
            { type: 'boolean', name: 'confirm', label: 'Bekreftelse på alle hurtigknapper', default: false },
            { type: 'select', name: 'smart_until', label: 'Smartlading: ferdig før', options: [5, 6, 7, 8, 9].map((x) => [x, `kl. ${M.pad(x)}:00`]), default: DEF.smart_until, help: 'Smartlading viser de 12 timene før dette klokkeslettet og velger de billigste.' },
            { type: 'text', name: 'prefix', label: 'Prefiks for autofunn', placeholder: DEF_PREFIX.join(', '), help: 'Kommaseparert. Entiteter som inneholder prefikset (og Tesla-integrasjonens entiteter) brukes.' },
          ] },
          M.spacingSchema({ gap: 8, pad_top: 20, pad_bottom: 24 }),
          reset,
        ] },
      ] },
    ];
  }

  /* ============================================================ kortet */
  class Tesla extends M.Card {
    static get cardName() { return 'Tesla'; }
    static get defaults() { return { ...DEF }; }
    static getStubConfig() { return { card_id: M.uid() }; }
    static get schema() { return editorSchema; }
    static get uiPersist() { return ['tab', 'sp']; }
    get cardSize() { return 12; }
    _e(k) { return entOf(this.hass, this.config, k); }
    _S(k) { return this.s(this._e(k)); }
    _N(k) { return numS(this._S(k)); }
    get tab() { const V = visTabs(this.config), t = this.ui.tab || tabsCfg(this.config).start; return V.includes(t) ? t : V[0]; }
    _bid(k) { return btnCfg(this.config, k).entity || this._e(k); }
    _conf(k) { const b = btnCfg(this.config, k); return this.config.confirm === true || (b.confirm != null ? !!b.confirm : CONF_DEF[k]); }
    onOpen() { this._load(); }

    /* ---------------------------------------------------------- data */
    async _load() {
      const h = this.hass;
      if (!h || !this.isOpen) return;
      const daily = this._e('daily'), saved = this._e('saved_year') || this._e('saved_month');
      const key = daily + '|' + saved;
      if (this._lk === key && Date.now() - (this._lt || 0) < TTL) return;
      this._lk = key; this._lt = Date.now();
      const [D, S] = await Promise.all([daily ? dayStats(h, daily, 7) : null, saved ? dayStats(h, saved, 31) : null]);
      this._daily = D; this._saved = S;
      if (this.isConnected) this.update();
    }
    _days7() {
      const D = this._daily, now = this._N('daily');
      return Array.from({ length: 7 }, (_, i) => {
        const d = d0(i - 6), x = D && D.get(dk(d));
        let v = x ? (x.max != null ? x.max : x.change) : null;
        if (i === 6 && now != null) v = now; // i dag: live
        return { d, v };
      });
    }
    _days30() {
      const S = this._saved;
      const out = [];
      let prev = null;
      for (let i = -30; i <= 0; i++) {
        const d = d0(i), x = S && S.get(dk(d));
        let v = null;
        if (x) {
          if (x.change != null) v = Math.max(0, x.change);
          else { const cur = x.last != null ? x.last : x.max; if (cur != null && prev != null) v = Math.max(0, cur - prev); if (cur != null) prev = cur; }
        }
        if (i > -30) out.push({ d, v });
      }
      return out;
    }

    /* ---------------------------------------------------------- tegning */
    render() {
      const c = this.config, t = this.tab, V = visTabs(c);
      const tabs = `<div class="trow"><div class="tbox"><div class="tabs msh-tr" role="tablist" data-gd-skip>${V.map((k) => tabBtn(c, k, k === t, `data-act="tab" data-key="${k}" data-v="${k}" data-haptic="selection"`)).join('')}</div></div>
        <button class="gear" data-act="customize" data-haptic="light" aria-label="Tilpass Tesla">${M.icon('mdi:cog', 22)}</button></div>`;
      let body;
      try { body = this['_t_' + t](); } catch (e) { body = this._failHTML(e); }
      return `<div class="wrap"><div class="scene-slot" data-nomorph></div>${this._buttons()}${tabs}<div class="pane" data-key="pane-${t}">${body}</div></div>`;
    }
    _miss(text, section) { return `<div class="miss"><span class="mdash">–</span><button class="pick press" data-act="customize" data-section="${esc(section || 'entiteter')}">${M.icon('mdi:plus', 18)}Velg entitet</button>${text ? `<span class="mt">${esc(text)}</span>` : ''}</div>`; }
    _buttons() {
      const c = this.config, h = this.hass, txt = c.button_text !== false;
      const B = BTNS.filter(([k]) => btnCfg(c, k).show !== false);
      if (!B.length) return '';
      return `<div class="qb${txt ? ' txt' : ''}" style="--qn:${B.length}">${B.map(([k, label, icon]) => {
        const id = this._bid(k), st = id ? this.s(id) : null;
        let cls = '', ic = icon, lab = label;
        // Fiks 26.10: aktiv tilstand (defrost på, frunk/bagasje åpen) = lys flis #e1e1e1 med mørkt ikon og tekst
        let aria = lab;
        if (k === 'lock') { const ul = st ? unlocked(h, { ...c, entities: { ...(c.entities || {}), lock: id } }) : false; if (ul) { cls = 'warn shake'; ic = 'mdi:lock-open'; lab = 'Ulåst'; } else if (st) lab = 'Låst'; aria = lab; }
        if (k === 'defrost' && st && st.state === 'on') { cls = 'act'; aria = 'Defrost på'; }
        if ((k === 'frunk' || k === 'trunk') && isOpen(st)) { cls = 'act'; aria = k === 'frunk' ? 'Frunk åpen' : 'Bagasje åpen'; }
        if (!id || !st) cls = 'none';
        return `<button class="qbtn press ${cls}" data-act="btn" data-v="${k}" ${id && st ? `data-ent="${esc(id)}"` : ''} aria-label="${esc(aria)}${!id ? ' – velg entitet' : ''}"><span class="qi">${M.icon(ic, 22)}</span>${txt ? `<span class="ql">${esc(lab)}</span>` : ''}</button>`;
      }).join('')}</div>`;
    }
    _btn(k) {
      const id = this._bid(k), h = this.hass;
      if (!id || !h.states[id]) return this.customize('buttons');
      const st = h.states[id], dom = id.split('.')[0], on = isOpen(st);
      let q, ok, run;
      if (k === 'lock') {
        const ul = unlocked(h, { ...this.config, entities: { ...(this.config.entities || {}), lock: id } });
        q = ul ? 'Låse bilen?' : 'Låse opp bilen?'; ok = ul ? 'Lås' : 'Lås opp';
        run = () => (dom === 'lock' ? M.call(h, 'lock', ul ? 'lock' : 'unlock', { entity_id: id }) : dom === 'binary_sensor' ? M.moreInfo(this, id) : M.toggle(h, id));
      } else if (k === 'honk') {
        q = 'Tute med bilen?'; ok = 'Tut';
        run = () => (dom === 'button' || dom === 'input_button' ? M.call(h, dom, 'press', { entity_id: id }) : M.toggle(h, id));
      } else {
        const n = { defrost: 'defrost', frunk: 'frunken', trunk: 'bagasjerommet' }[k];
        q = k === 'defrost' ? (on ? 'Slå av defrost?' : 'Slå på defrost?') : (on ? `Lukke ${n}?` : `Åpne ${n}?`);
        ok = k === 'defrost' ? (on ? 'Slå av' : 'Slå på') : (on ? 'Lukk' : 'Åpne');
        run = () => (dom === 'cover' ? M.call(h, 'cover', on ? 'close_cover' : 'open_cover', { entity_id: id }) : M.toggle(h, id));
      }
      if (this._conf(k)) confirmDlg(q, ok, () => Promise.resolve(run()).catch(() => {}));
      else Promise.resolve(run()).catch(() => {});
    }

    /* ---------------------------------------------------------- Lading (Fiks 26.10: ett samlet kort + nøkkeltall + Smartlading) */
    _t_lading() {
      const c = this.config, h = this.hass;
      const bat = this._N('battery'), lim = this._N('charge_limit'), limId = this._e('charge_limit');
      const S = charging(h, c);
      ['charging_state', 'charger', 'charge_power', 'charge_cable'].forEach((k) => this._S(k));
      const swId = this._e('charger'), sw = swId ? this.s(swId) : null;
      const known = !!(this._e('charging_state') || swId || this._e('charge_power') || this._e('charge_cable'));
      const stTxt = S.lader ? 'Tilkoblet · lader' : S.ferdig ? 'Tilkoblet · ferdig ladet' : S.tilkoblet ? 'Tilkoblet · lader ikke' : known ? 'Ikke tilkoblet' : '–';
      const start = swId && sw
        ? `<button class="ss press" data-act="charge" data-ent="${esc(swId)}" data-haptic="light">${M.icon(sw.state === 'on' ? 'mdi:stop' : 'mdi:flash', 18)}${sw.state === 'on' ? 'Stopp' : 'Start'}</button>`
        : `<button class="ss press" data-act="customize" data-section="ent-lading" aria-label="Velg lader">${M.icon('mdi:flash', 18)}Start</button>`;
      // batteristolpe 56 px (0–100 %): grønt fyll med «79%» inni + hvit markering for ladegrensen. Dra setter grensen.
      const cur = this.ui.limDraft != null ? this.ui.limDraft : lim;
      const bp = bat != null ? M.clamp(bat, 0, 100) : 0, lp = cur != null ? M.clamp(cur, 0, 100) : null;
      const bar = `<div class="lim${limId ? '' : ' ro'}" data-key="lim" ${limId ? `role="slider" aria-label="Ladegrense" aria-valuemin="50" aria-valuemax="100" aria-valuenow="${cur != null ? Math.round(cur) : ''}" tabindex="0"` : 'aria-hidden="true"'} style="--b:${bp.toFixed(2)};--f:${lp != null ? lp.toFixed(2) : 0}">
          <div class="lbat${S.lader ? ' chg' : ''}"></div><span class="lpct num">${bat != null ? Math.round(bat) + '%' : '–'}</span>${lp != null ? '<i class="lmk"></i>' : ''}</div>`;
      const limRow = limId
        ? `<div class="lrow"><span class="ll">Ladegrense <b class="lv num" data-key="lv">${cur != null ? Math.round(cur) + ' %' : '–'}</b></span>
            <div class="lb">${limitsOf(c).map((v) => `<button class="lchip press ${cur != null && Math.round(cur) === v ? 'on' : ''}" data-act="limit" data-v="${v}" data-haptic="selection" aria-label="Ladegrense ${v} %">${v}</button>`).join('')}</div></div>`
        : `<div class="lrow"><span class="ll">Ladegrense</span>${this._miss('', 'ent-lading')}</div>`;
      const main = `<div class="card lc">
        <div class="lhead"><div class="grow col"><span class="lt2">${esc(stTxt)}</span><span class="big num">${S.eff != null ? M.nf(S.eff, 1) : '–'}<small>kW</small></span></div>${start}</div>
        ${bar}${limRow}</div>`;
      // nøkkeltall: ett kort, 3 kolonner med skillelinjer (etikett over verdi, ingen ikoner)
      let tl = this._N('time_left');
      if (tl == null && S.lader && S.eff > 0.3 && lim != null && bat != null && lim > bat) tl = ((lim - bat) / 100) * (Number(c.capacity) || DEF.capacity) / S.eff * 60;
      const tlTxt = tl == null ? '–' : tl < 1 ? 'under 1 min' : (tl >= 60 ? `${Math.floor(tl / 60)} t ${Math.round(tl % 60)} m` : `${Math.round(tl)} min`);
      const kpi = `<div class="card kpi">${[[lim != null ? `Tid til ${Math.round(lim)} %` : 'Tid til grensen', tlTxt, 'time_left'], ['Pris', kr(this._N('charge_cost'), 0), 'charge_cost'], ['Sist lading', kr(this._N('last_charge'), 0), 'last_charge']].map(([l, v, k]) => `<div class="kc" ${this._e(k) ? `data-ent="${esc(this._e(k))}"` : ''}><span class="kl">${esc(l)}</span><span class="kv num">${esc(v)}</span></div>`).join('')}</div>`;
      return `<div class="col gap">${main}${kpi}${this._smart(bat, lim, S)}</div>`;
    }
    // Smartlading: bryter + de 12 timene før fristen (standard 07:00) med pris per time; de billigste timene er rosa
    _smart(bat, lim, S) {
      const h = this.hass, c = this.config, ov = (c.entities || {}).price;
      let today = [], tomorrow = [], fmt = (v) => (v == null ? '–' : M.nf(v, 2) + ' kr');
      try {
        if (ov) { this.s(ov); const s = M.priceSeries(h, ov); today = s.slice(0, 24); tomorrow = s.slice(24); }
        else if (M.powerPrice) { const P = M.powerPrice(h, null, this); today = P.today || []; tomorrow = P.tomorrow || []; if (P.fmt) fmt = (v) => P.fmt(v, { unit: false }); if (P.entity) this.s(P.entity); }
      } catch (e) { /* ingen pris */ }
      const until = M.clamp(Math.round(Number(c.smart_until != null ? c.smart_until : DEF.smart_until)) || DEF.smart_until, 0, 23);
      const now = new Date(), hr = now.getHours();
      const end = hr < until ? until : until + 24, from = end - 12; // timeindeks: 0–23 i dag, 24–47 i morgen
      const at = (i) => (i < 0 ? null : i < 24 ? today[i] : tomorrow[i - 24]);
      const bars = Array.from({ length: 12 }, (_, j) => { const i = from + j, v = at(i); return { i, h: ((i % 24) + 24) % 24, v: v == null || isNaN(v) ? null : Number(v), past: i < hr }; });
      // timer som trengs for å nå grensen (ellers 1): fra «tid til grense» eller kapasitet × (grense − batteri) / effekt
      let need = null;
      const tl = this._N('time_left');
      if (tl != null && tl > 0) need = Math.ceil(tl / 60);
      else if (lim != null && bat != null && lim > bat) need = Math.ceil(((lim - bat) / 100) * (Number(c.capacity) || DEF.capacity) / (S.eff > 0.3 ? S.eff : 11));
      const fut = bars.map((x, j) => [x, j]).filter(([x]) => x.v != null && !x.past);
      need = M.clamp(need || 1, 1, Math.max(1, fut.length));
      const cheap = new Set(fut.sort((a, b) => a[0].v - b[0].v).slice(0, need).map((x) => x[1]));
      const vals = bars.filter((x) => x.v != null).map((x) => x.v);
      const mx = vals.length ? Math.max(...vals) : 1, mn = vals.length ? Math.min(0, ...vals) : 0;
      const swId = this._e('smart'), sw = swId ? this.s(swId) : null, on = !!sw && sw.state === 'on';
      const txt = `Lader i ${need === 1 ? 'den billigste timen' : `de ${need} billigste timene`} før ${M.pad(until)}:00`;
      const tog = swId && sw
        ? `<button class="tg${on ? ' on' : ''}" role="switch" aria-checked="${on}" aria-label="Smartlading" data-act="smart" data-ent="${esc(swId)}" data-haptic="selection"><i></i></button>`
        : `<button class="tg none" role="switch" aria-checked="false" aria-label="Smartlading – velg entitet" data-act="customize" data-section="ent-lading"><i></i></button>`;
      const graph = vals.length
        ? `<div class="pb">${bars.map((x, j) => `<i class="${cheap.has(j) ? 'c' : ''}${x.past ? ' p' : ''}${x.v == null ? ' x' : ''}" style="height:${x.v == null ? 4 : Math.max(8, ((x.v - mn) / ((mx - mn) || 1)) * 100).toFixed(1) + '%'}${x.v == null ? 'px' : ''}" title="kl. ${M.pad(x.h)} · ${esc(fmt(x.v))}"></i>`).join('')}</div>
          <div class="pl">${[0, 4, 8, 11].map((j) => `<span style="left:calc((100% + 4px) * ${j} / 12 + (100% + 4px) / 24 - 2px)">${M.pad(bars[j].h)}:00</span>`).join('')}</div>`
        : this._miss('Fant ingen timepriser', 'ent-lading');
      return `<div class="card sm"><div class="srow"><span class="sci">${M.icon('mdi:clock-outline', 20)}</span><div class="grow col"><span class="stt">Smartlading</span><span class="sst">${esc(txt)}</span></div>${tog}</div>${graph}</div>`;
    }

    /* ---------------------------------------------------------- Kjøring */
    _t_kjoring() {
      const rng = this._N('range'), bat = this._N('battery'), lim = this._N('charge_limit');
      const atLim = rng != null && bat > 0 && lim != null ? rng / bat * lim : null;
      const range = this._e('range') ? `<div class="card rc" data-ent="${esc(this._e('range'))}">
        <div class="row"><span class="lt grow">Rekkevidde</span>${bat != null ? `<span class="sub">${Math.round(bat)} %</span>` : ''}</div>
        <span class="big num">${rng != null ? M.nf(rng, 0) : '–'}<small>km</small></span>
        <div class="rb"><i style="width:${bat != null ? M.clamp(bat, 0, 100) : 0}%"></i>${lim != null ? `<b style="left:${M.clamp(lim, 0, 100)}%"></b>` : ''}</div>
        <span class="sub">${atLim != null ? `Ved ladegrensen ${Math.round(lim)} %: ca ${M.nf(atLim, 0)} km` : lim != null ? `Ladegrense ${Math.round(lim)} %` : ''}</span></div>`
        : `<div class="card rc"><span class="lt">Rekkevidde</span>${this._miss('', 'ent-lading')}</div>`;
      // daglig km siste 7 dager
      let daily;
      if (this._e('daily')) {
        const D = this._days7(), mx = Math.max(1, ...D.map((x) => x.v || 0));
        const sel = this.ui.day != null && this.ui.day >= 0 && this.ui.day < 7 ? this.ui.day : 6, sd = D[sel];
        daily = `<div class="card dc"><div class="row"><span class="lt grow">Daglig kjøring</span><span class="sub">siste 7 dager</span></div>
          <div class="smt"><span class="big2 num">${sd.v != null ? M.nf(sd.v, 0) + ' km' : '–'}</span><span class="sub">${sel === 6 ? 'i dag' : sel === 5 ? 'i går' : UKE[sd.d.getDay()] + ' ' + sd.d.getDate() + '.'}</span></div>
          <div class="db">${D.map((x, i) => `<button class="dbar${i === sel ? ' on' : ''}" data-act="day" data-v="${i}" data-haptic="selection" aria-label="${UKE[x.d.getDay()]}: ${x.v != null ? Math.round(x.v) + ' km' : 'ingen data'}"><i style="height:${x.v ? Math.max(4, x.v / mx * 100).toFixed(1) : 2}%"></i><span>${UKE[x.d.getDay()].slice(0, 2)}</span></button>`).join('')}</div></div>`;
      } else daily = `<div class="card dc"><span class="lt">Daglig kjøring</span>${this._miss('', 'ent-status')}</div>`;
      const odo = this._N('odometer'), D7 = this._e('daily') ? this._days7().filter((x) => x.v != null) : [];
      const avg = D7.length ? D7.reduce((s, x) => s + x.v, 0) / D7.length : null;
      const tiles = `<div class="sum two"><div class="card st" ${this._e('odometer') ? `data-ent="${esc(this._e('odometer'))}"` : ''}>${M.icon('mdi:counter', 20, 'color:#afafaf')}<span class="sv num">${odo != null ? M.nf(odo, 0) + ' km' : '–'}</span><span class="sl">Kilometerstand</span></div>
        <div class="card st">${M.icon('mdi:chart-line-variant', 20, 'color:#afafaf')}<span class="sv num">${avg != null ? M.nf(avg, 0) + ' km' : '–'}</span><span class="sl">Snitt per dag</span></div></div>`;
      return `<div class="col gap">${range}${daily}${tiles}</div>`;
    }

    /* ---------------------------------------------------------- Sparing */
    _t_sparing() {
      const h = this.hass;
      const any = ['saved_month', 'saved_year', 'cost_ev', 'cost_diesel', 'diesel_price'].some((k) => this._e(k));
      if (!any) return `<div class="card"><span class="lt">Sparing</span>${this._miss('Fant ingen KI Drivstoff-sensorer', 'ent-sparing')}</div>`;
      const sp = this.ui.sp === 'aar' ? 'aar' : 'maned', k = sp === 'aar' ? 'saved_year' : 'saved_month';
      const st = this._S(k), a = (st && st.attributes) || {}, saved = numS(st);
      const dsl = a.diesel_ville_kostet != null ? Number(a.diesel_ville_kostet) : null, el = a.strom_kostet != null ? Number(a.strom_kostet) : null;
      const pct = dsl > 0 && el != null ? Math.round((1 - el / dsl) * 100) : null;
      const seg = `<div class="seg" role="tablist" data-glass-drag="x">${[['maned', 'Måned'], ['aar', 'År']].map(([x, l]) => `<button class="sg ${x === sp ? 'on' : ''}" role="tab" aria-selected="${x === sp}" data-act="sp" data-v="${x}" data-haptic="selection">${l}</button>`).join('')}</div>`;
      const dp = this._S('diesel_price'), dpv = numS(dp), cp = this._N('charge_price');
      const pump = dpv == null ? `<button class="pump press" data-act="fuel">${M.icon('mdi:gas-station-off', 22)}<span class="grow"><b>Pumpepris mangler</b> · trykk for å hente</span>${M.icon('mdi:refresh', 20)}</button>` : '';
      const head = `<div class="card sv0" ${this._e(k) ? `data-ent="${esc(this._e(k))}"` : ''}><div class="row"><span class="lt grow">Spart ${sp === 'aar' ? 'i år' : 'denne måneden'}</span>${seg}</div>
        <span class="big num">${saved != null ? M.nf(saved, 0) : '–'}<small>kr</small></span>
        ${dsl != null ? `<div class="vs"><div class="vr"><span>Diesel</span><div class="vt"><i style="width:100%;background:${ORANGE}"></i></div><b class="num">${kr(dsl)}</b></div>
          <div class="vr"><span>Strøm</span><div class="vt"><i style="width:${dsl > 0 && el != null ? M.clamp(el / dsl * 100, 2, 100).toFixed(1) : 0}%;background:${GREEN}"></i></div><b class="num">${kr(el)}</b></div></div>` : `<span class="sub">${saved != null ? 'Venter på de første kilometerne' : ''}</span>`}
        ${pct != null ? `<span class="pct"><b class="num">${pct} %</b> billigere enn diesel</span>` : ''}</div>`;
      const ev = this._N('cost_ev'), ds = this._N('cost_diesel');
      const nm = (kk, d) => { const id = this._e(kk); const n = id && h.states[id] ? String(h.states[id].attributes.friendly_name || '').replace(/^.*?Kostnad per mil\s*[–-]\s*/i, '') : ''; return n || d; };
      const tile = (ic, l, v, u, kk) => `<div class="card st" ${this._e(kk) ? `data-ent="${esc(this._e(kk))}"` : ''}>${M.icon(ic, 20, 'color:#afafaf')}<span class="sv num">${v}${v !== '–' && u ? `<small>${u}</small>` : ''}</span><span class="sl">${esc(l)}</span></div>`;
      const tiles = `<div class="sum two">${tile('mdi:car-electric', nm('cost_ev', 'Tesla'), ev != null ? M.nf(ev, 2) : '–', 'kr/mil', 'cost_ev')}${tile('mdi:car-estate', nm('cost_diesel', 'Diesel'), ds != null ? M.nf(ds, 2) : '–', 'kr/mil', 'cost_diesel')}
        ${tile('mdi:fuel', 'Diesel ikke fylt', this._N('diesel_liters') != null ? M.nf(this._N('diesel_liters'), 0) : '–', 'L', 'diesel_liters')}${tile('mdi:molecule-co2', 'CO₂ spart', this._N('co2') != null ? M.nf(this._N('co2'), 0) : '–', 'kg', 'co2')}</div>`;
      // spart per dag siste 30 dager (scrub)
      let perDay = '';
      if (this._e('saved_year') || this._e('saved_month')) {
        const D = this._days30(), mx = Math.max(1, ...D.map((x) => x.v || 0));
        const sel = this.ui.sd != null && this.ui.sd >= 0 && this.ui.sd < D.length ? this.ui.sd : D.length - 1, sd = D[sel];
        perDay = `<div class="card pd"><div class="row"><span class="lt grow">Spart per dag</span><span class="sub">siste 30 dager</span></div>
          <div class="smt"><span class="big2 num">${sd && sd.v != null ? kr(sd.v) : '–'}</span><span class="sub">${sd ? (sel === D.length - 1 ? 'i dag' : `${UKE[sd.d.getDay()]} ${sd.d.getDate()}.${sd.d.getMonth() + 1}.`) : ''}</span></div>
          <div class="scrub" data-key="scrub" aria-label="Spart per dag – dra for å velge dag">${D.map((x, i) => `<i class="${i === sel ? 'on' : ''}" style="height:${x.v ? Math.max(4, x.v / mx * 100).toFixed(1) : 2}%"></i>`).join('')}</div></div>`;
      }
      const line = `<div class="line2">${M.icon('mdi:gas-station', 18, 'color:#979797')}<span>Diesel ${dpv != null ? M.nf(dpv, 2) + ' kr/L' : '–'} · Strøm ${cp != null ? M.nf(cp, 2) + ' kr/kWh' : '–'}</span></div>`;
      return `<div class="col gap">${pump}${head}${tiles}${perDay}${line}</div>`;
    }

    /* ---------------------------------------------------------- handlinger */
    onAction(name, el, e) {
      const d = el.dataset, h = this.hass;
      if (name === 'tab') { if (d.v && d.v !== this.tab) { this.setUI({ tab: d.v }); } return; }
      if (name === 'btn') return this._btn(d.v);
      if (name === 'charge') { const id = this._e('charger'); if (id && h.states[id]) M.call(h, 'switch', h.states[id].state === 'on' ? 'turn_off' : 'turn_on', { entity_id: id }).catch(() => {}); return; }
      if (name === 'limit') return this._setLimit(Number(d.v));
      if (name === 'smart') { const id = this._e('smart'); if (id && h.states[id]) M.toggle(h, id); return; }
      if (name === 'day') return this.setUI({ day: Number(d.v) });
      if (name === 'sp') return this.setUI({ sp: d.v, sd: null });
      if (name === 'fuel') { M.call(h, 'ki_drivstoff', 'hent_pris', {}).then(() => M.toast('Henter pumpepris …')).catch(() => {}); return; }
      return super.onAction(name, el, e);
    }
    _setLimit(v) {
      const id = this._e('charge_limit'), h = this.hass;
      if (!id || !h.states[id]) return;
      v = M.clamp(Math.round(v / 5) * 5, 50, 100);
      this.setUI({ limDraft: v });
      clearTimeout(this._limT); this._limT = setTimeout(() => this.setUI({ limDraft: null }), 4000);
      M.call(h, id.split('.')[0], 'set_value', { entity_id: id, value: v }).catch(() => this.setUI({ limDraft: null }));
    }
    _mountScene() {
      const slot = this.shadowRoot.querySelector('.scene-slot');
      if (!slot || !customElements.get('msh-tesla-scene')) return;
      if (!this._scene) { this._scene = document.createElement('msh-tesla-scene'); this._scene.style.setProperty('--ha-card-border-radius', '28px'); }
      const c = this.config, h = this.hass, E = (k) => entOf(h, c, k);
      const cfg = { navn: c.name || DEF.name, lakk: paintOf(c), kapasitet: Number(c.capacity) || DEF.capacity, laas_omvendt: c.lock_inverted !== false, tap_action: { action: 'none' }, prefiks: prefixes(c),
        batteri: E('battery'), rekkevidde: E('range'), effekt: E('charge_power'), ladestatus: E('charging_state'), ladeport: E('charge_port'), lader: E('charger'), ladegrense: E('charge_limit'),
        laas: this._bid('lock'), bagasje: this._bid('trunk'), frunk: this._bid('frunk'), sentry: E('sentry'), klima: E('climate'), innetemp: E('inside_temp'), gir: E('shift'), fart: E('speed'),
        defrost: this._bid('defrost'), vindu: E('window'), kabel: E('charge_cable') };
      const j = JSON.stringify(cfg);
      if (j !== this._sceneJ) { this._sceneJ = j; this._scene.setConfig(cfg); }
      if (this._scene.parentNode !== slot) slot.appendChild(this._scene);
      if (this._scene._hass !== h) this._scene.hass = h;
    }
    set hass(h) { super.hass = h; if (this._scene && this._scene.isConnected) this._scene.hass = h; }
    get hass() { return super.hass; }
    afterRender() {
      this._mountScene();
      const R = this.shadowRoot, row = R.querySelector('.tabs');
      if (row && M.tabReorder) M.tabReorder(row, {
        card: this, glass: true,
        items: () => Array.from(row.querySelectorAll('.tab')),
        idOf: (b) => b.dataset.key,
        active: () => this.tab,
        onSelect: (k) => { if (k !== this.tab) this.setUI({ tab: k }); },
        onReorder: (keys) => { const T = tabsCfg(this.config), hid = T.hidden || []; M.mshPatchConfig(this, { tabs: { ...((this._rawConfig || {}).tabs || {}), order: keys.concat(tabOrder(this.config).filter((k) => !keys.includes(k) && hid.includes(k))) } }); },
      });
      if (M.glassDrag) R.querySelectorAll('.seg').forEach((s) => M.glassDrag(s, { axis: 'x' }));
      if (!this.__bound) { this.__bound = true; this._bindDrag(); }
      if (this.isOpen) this._load();
    }
    // Ladegrense-dra og sparing-scrub: touch-action none + stopPropagation (fallgruve 2)
    _bindDrag() {
      const R = this.shadowRoot;
      const tgt = (e) => (e.composedPath ? e.composedPath() : []).find((n) => n && n.classList && ((n.classList.contains('lim') && !n.classList.contains('ro')) || n.classList.contains('scrub')));
      R.addEventListener('touchstart', (e) => { if (tgt(e)) e.stopPropagation(); }, { passive: true });
      R.addEventListener('touchmove', (e) => { if (tgt(e)) { e.stopPropagation(); if (e.cancelable) e.preventDefault(); } }, { passive: false });
      let g = null;
      // Fiks 26.10: batteristolpen går 0–100 %; grensen kan settes mellom 50 og 100 %
      const limVal = (el, x) => { const r = el.getBoundingClientRect(); return M.clamp((x - r.left) / (r.width || 1) * 100, 50, 100); };
      const scrubIdx = (el, x) => { const r = el.getBoundingClientRect(), n = el.children.length; return M.clamp(Math.floor((x - r.left) / ((r.width || 1) / n)), 0, n - 1); };
      const paintLim = (el, v) => {
        const s = Math.round(v / 5) * 5;
        el.style.setProperty('--f', s.toFixed(2));
        const lv = R.querySelector('.lv'); if (lv) lv.textContent = s + ' %';
        R.querySelectorAll('.lchip').forEach((b) => b.classList.toggle('on', Number(b.dataset.v) === s));
        if (g.last !== s) { if (g.last != null) M.haptic('selection'); g.last = s; }
      };
      R.addEventListener('pointerdown', (e) => {
        const el = tgt(e);
        if (!el || e.button) return;
        e.stopPropagation();
        try { el.setPointerCapture(e.pointerId); } catch (x) { /* */ }
        g = { el, id: e.pointerId, lim: el.classList.contains('lim'), last: null };
        if (g.lim) { this._busy = true; el.classList.add('drag'); M.haptic('light'); paintLim(el, limVal(el, e.clientX)); }
        else { const i = scrubIdx(el, e.clientX); M.haptic('selection'); g.last = i; this.setUI({ sd: i }); }
      });
      R.addEventListener('pointermove', (e) => {
        if (!g || e.pointerId !== g.id) return;
        e.stopPropagation();
        if (g.lim) { const el = R.querySelector('.lim') || g.el; paintLim(el, limVal(el, e.clientX)); return; }
        const el = R.querySelector('.scrub') || g.el, i = scrubIdx(el, e.clientX);
        if (i !== g.last) { g.last = i; M.haptic('selection'); this.setUI({ sd: i }); }
      });
      const up = (e) => {
        if (!g || e.pointerId !== g.id) return;
        e.stopPropagation();
        const G = g; g = null;
        if (G.lim) {
          const el = R.querySelector('.lim') || G.el; el.classList.remove('drag');
          this._busy = false;
          if (e.type !== 'pointercancel' || G.last != null) this._setLimit(G.last != null ? G.last : limVal(el, e.clientX));
          else this.update();
        }
      };
      R.addEventListener('pointerup', up);
      R.addEventListener('pointercancel', up);
    }

    get styles() {
      return `
        .wrap{display:flex;flex-direction:column;gap:var(--msh-gap,8px)}
        .col{display:flex;flex-direction:column}.gap{gap:var(--msh-gap,8px)}
        .scene-slot{display:block;min-height:180px}
        .scene-slot msh-tesla-scene{display:block;--ha-card-border-radius:28px}
        /* Fiks 26.10: hurtigknapper – 5 like brede fliser, 76 px høye, r22, #3a3a3a, gap 8; ikon 22 over etikett 15/500 */
        .qb{display:grid;grid-template-columns:repeat(var(--qn,5),minmax(0,1fr));gap:8px}
        .qbtn{height:76px;border-radius:22px;background:var(--gray200,#3a3a3a);box-shadow:${C.edge};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--white,#fafafa);min-width:0;padding:0 1px;transition:background .3s,color .3s,transform .15s cubic-bezier(.34,1.5,.64,1)}
        .qbtn .ql{font-size:15px;font-weight:500;line-height:18px;letter-spacing:-.01em;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .qbtn.warn{background:${ORANGE};color:#2c1d0c}
        .qbtn.act{background:var(--gray1000,#e1e1e1);color:var(--gray200,#3a3a3a)}
        .qbtn.none{color:var(--gray600,#7f7f7f)}
        .qbtn.shake .qi{animation:rist 2.6s ease-in-out infinite}
        .qbtn.breathe{animation:pust 2.4s ease-in-out infinite}
        @keyframes rist{0%,78%,100%{transform:rotate(0)}82%{transform:rotate(-12deg)}86%{transform:rotate(10deg)}90%{transform:rotate(-8deg)}94%{transform:rotate(5deg)}}
        @keyframes pust{0%,100%{filter:brightness(1);box-shadow:0 0 0 0 rgba(242,133,201,.0)}50%{filter:brightness(1.08);box-shadow:0 0 0 6px rgba(242,133,201,.18)}}
        .qi{display:grid;place-items:center}
        ${M.TAB_ROW_CSS || ''}
        ${TAB_CSS('')}
        .card{padding:16px 18px;display:flex;flex-direction:column;gap:10px;min-width:0}
        .lt{font-size:14px;font-weight:500;color:var(--gray1000,#e1e1e1)}
        .sub{font-size:12px;color:var(--gray700,#979797)}
        .big{font-size:40px;font-weight:300;line-height:1.05;letter-spacing:-.01em}
        .big small,.sv small{font-size:15px;font-weight:400;margin-left:4px;color:var(--gray800,#afafaf)}
        .big2{font-size:24px;font-weight:400}
        .smt{display:flex;align-items:baseline;gap:10px}
        /* Fiks 26.10: Lading – ett kort: status + effekt, mørk Start-pill, batteristolpe 56 px med grensemarkør, grense-chips */
        .lhead{display:flex;align-items:flex-start;gap:12px}
        .lt2{font-size:14px;color:var(--gray800,#afafaf)}
        .lc .big{font-size:36px;font-weight:300;margin-top:2px}
        .ss{height:40px;padding:0 16px 0 12px;border-radius:20px;background:#4a4a4a;color:var(--white,#fafafa);font-size:14px;font-weight:500;display:inline-flex;align-items:center;gap:6px;flex:none}
        .lim{position:relative;height:56px;border-radius:18px;background:var(--gray300,#404040);overflow:hidden;touch-action:none;cursor:pointer;user-select:none;-webkit-user-select:none;margin-top:4px}
        .lim.ro{cursor:default}
        .lbat{position:absolute;left:0;top:0;bottom:0;width:calc(var(--b) * 1%);background:${GREEN};transition:width .4s}
        .lpct{position:absolute;left:16px;top:0;bottom:0;display:flex;align-items:center;font-size:17px;font-weight:600;color:#12291d;pointer-events:none}
        .lmk{position:absolute;top:8px;bottom:8px;width:3px;border-radius:2px;background:#fafafa;box-shadow:0 0 0 1px rgba(0,0,0,.25);left:calc(var(--f) * 1% - 1.5px);transition:left .25s;pointer-events:none}
        .lim.drag .lmk{transition:none}
        .lrow{display:flex;align-items:center;gap:6px}
        .ll{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14px;color:var(--gray800,#afafaf)}
        .ll b{font-weight:600;color:var(--white,#fafafa);margin-left:2px}
        .lb{display:flex;gap:3px;flex:none}
        .lchip{min-width:30px;height:28px;padding:0 4px;border-radius:14px;background:var(--gray300,#404040);color:var(--white,#fafafa);font-size:12px;font-weight:500;font-variant-numeric:tabular-nums}
        .lchip.on{background:${ACC};color:${INK}}
        /* nøkkeltall: ett kort, 3 kolonner med skillelinjer */
        .kpi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;padding:14px 0}
        .kc{display:flex;flex-direction:column;gap:4px;padding:0 14px;min-width:0}
        .kc+.kc{border-left:1px solid rgba(255,255,255,.08)}
        .kl{font-size:14px;color:var(--gray800,#afafaf);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .kv{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        /* Smartlading: ikon-sirkel, tittel/tekst, bryter; 12 søyler med tidsakse */
        .srow{display:flex;align-items:center;gap:12px}
        .sci{width:40px;height:40px;border-radius:20px;background:var(--gray300,#404040);display:grid;place-items:center;flex:none;color:var(--white,#fafafa)}
        .stt{font-size:15px;font-weight:600}
        .sst{font-size:13px;color:var(--gray800,#afafaf)}
        .tg{position:relative;width:50px;height:30px;border-radius:15px;background:var(--gray400,#545454);flex:none;transition:background .2s}
        .tg i{position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:12px;background:#fafafa;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .2s cubic-bezier(.34,1.4,.64,1)}
        .tg.on{background:${PINK}}
        .tg.on i{transform:translateX(20px)}
        .tg.none{opacity:.5}
        .sum{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
        .sum.two{grid-template-columns:repeat(2,minmax(0,1fr))}
        .st{gap:4px;padding:14px}
        .sv{font-size:18px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .sl{font-size:12px;color:var(--gray700,#979797);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .pb{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));align-items:end;gap:4px;height:72px}
        .pb i{display:block;border-radius:5px 5px 2px 2px;background:var(--gray400,#545454);min-width:0}
        .pb i.p{opacity:.4}
        .pb i.x{background:var(--gray300,#404040)}
        .pb i.c{background:${PINK};opacity:1}
        .pl{position:relative;height:14px;font-size:11px;color:var(--gray600,#7f7f7f)}
        .pl span{position:absolute;top:0;transform:translateX(-50%);white-space:nowrap}
        .pl span:first-child{transform:none;left:0 !important}
        .pl span:last-child{transform:none;left:auto !important;right:0}
        .rb{position:relative;height:12px;border-radius:6px;background:var(--gray300,#404040)}
        .rb i{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:${GREEN}}
        .rb b{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;border-radius:1px;background:#fafafa}
        .db{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;height:110px}
        .dbar{display:flex;flex-direction:column;align-items:stretch;justify-content:flex-end;gap:6px;height:100%;min-width:0}
        .dbar i{display:block;border-radius:8px;background:var(--gray400,#545454);transition:background .2s}
        .dbar.on i{background:${BLUE}}
        .dbar span{font-size:11px;color:var(--gray700,#979797);text-align:center}
        .dbar.on span{color:var(--white,#fafafa)}
        .seg{display:inline-flex;padding:3px;border-radius:18px;background:#282828;gap:2px;flex:none}
        .sg{height:30px;padding:0 12px;border-radius:15px;font-size:12px;font-weight:500;color:var(--gray800,#afafaf)}
        .sg.on{background:${ACC};color:${INK}}
        .vs{display:flex;flex-direction:column;gap:8px}
        .vr{display:grid;grid-template-columns:52px 1fr auto;align-items:center;gap:10px;font-size:12px;color:var(--gray800,#afafaf)}
        .vr b{font-size:13px;font-weight:500;color:var(--white,#fafafa)}
        .vt{height:10px;border-radius:5px;background:var(--gray300,#404040);overflow:hidden}
        .vt i{display:block;height:100%;border-radius:5px}
        .pct{font-size:13px;color:var(--gray800,#afafaf)}.pct b{color:${GREEN};font-weight:600}
        .scrub{display:flex;align-items:flex-end;gap:2px;height:80px;touch-action:none;cursor:crosshair;user-select:none;-webkit-user-select:none}
        .scrub i{flex:1;min-width:0;border-radius:3px 3px 1px 1px;background:var(--gray400,#545454);pointer-events:none}
        .scrub i.on{background:${GREEN}}
        .pump{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 16px;border-radius:24px;background:${ORANGE};color:#2c1d0c;text-align:left;font-size:13px}
        .pump b{font-weight:600}
        .line2{display:flex;align-items:center;gap:8px;padding:4px 8px;font-size:12px;color:var(--gray700,#979797)}
        .miss{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
        .mdash{font-size:28px;font-weight:300;color:var(--gray600,#7f7f7f)}
        .mt{font-size:12px;color:var(--gray700,#979797)}
        @media (prefers-reduced-motion: reduce){.qbtn,.qbtn .qi{animation:none !important}}
      `;
    }
  }

  // Popup-registrering: #tesla (02-popups FUNCTION_POPUPS, 04-strategy vilkår) – bare når Tesla-entiteter finnes
  M.popupNeeds = M.popupNeeds || {};
  if (!M.popupNeeds[HASH]) M.popupNeeds[HASH] = (h) => M.teslaHas(h);
  // Den gamle importerte Tesla-popupen (ki-tesla-card + button-card/ki-tabs-card …) erstattes av den genererte (23.8-mønsteret)
  M.POPUP_SUPERSEDE = M.POPUP_SUPERSEDE || {};
  if (!M.POPUP_SUPERSEDE[HASH]) M.POPUP_SUPERSEDE[HASH] = { name: 'Tesla', test: (cfg) => /custom:ki-tesla-card/.test(JSON.stringify(cfg || {})) };
  M.POPUP_CARDS = M.POPUP_CARDS || [];
  if (!M.POPUP_CARDS.includes('msh-tesla-card')) M.POPUP_CARDS.push('msh-tesla-card');
  M.tesla = { autoAll, entOf, charging, unlocked, visTabs, tabOrder, FIELDS };
  M.define('msh-tesla-card', Tesla, 'MSH Tesla', 'Tesla-popup (#tesla): bilscenen, hurtigknapper, Lading, Kjøring og Sparing med «Tilpass Tesla».');
})();
