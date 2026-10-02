/* 42-klima-blokker.js · Blokkene i Klima-popupen (#klima), fiks-4 punkt 4.2/4.3.
 * Skallet (42-klima.js: hero, modus-bobler, fanerad, «Tilpass klima») kaller funksjonene her ved render –
 * grensesnittet står i klima-api.md. Denne fila lastes før skallet ('-' < '.').
 *
 * Funksjon og data: KI Energi-integrasjonen, slik ki-klima-strom-kort.js v1.23.0 leser den. All logikk er
 * beholdt: mapId (input_* → switch/number/text/time/datetime), _kall + TJENESTER → ki_energi.*, HJELP-tekstene,
 * _har-reglene, _harLading, _l (hytte-etiketter), _dognplan, _manedStripe, _dognGraf, _timeSoyler, _prisStripe,
 * _sparingBlokk, _prognoseBlokk, _lading/_elbilVindu, beslutningslogg, tidskonstanter, tarifftabell, diagnostikk og
 * råtilstand. Bare presentasjonen er byttet til designet (Klima v2/v3): felles blokk-kort med ikon · tittel · meta ·
 * chevron (kollaps huskes i card.ui.klima_collapsed), «?»-hjelp, radtyper (info · bryter · stepper · segment ·
 * måneds-stripe · døgnbånd · søyler · knapper), farlige handlinger med to trykk og glass-toast.
 * Ingen eksempeldata: mangler en entitet vises «–», og blokker integrasjonen ikke har skjules som i JS-kortet.
 */
(function () {
  const M = window.MSH;
  if (!M) return;
  const esc = M.esc;
  // Norsk komma med fast antall desimaler (som nf i JS-kortet); null/NaN → «–»
  const nf = (v, d = 1) => { if (v === null || v === undefined || v === '') return '–'; const n = Number(v); return isFinite(n) ? n.toFixed(d).replace('.', ',').replace(/^-(0,?0*)$/, '$1') : '–'; };
  const pad = (n) => String(n).padStart(2, '0');

  /* ================================================================ fra JS-kortet (uendret logikk) */
  const TIMESMALER_KANDIDATER = ['sensor.ki_time_energi'];
  const SONE_ENTITETER = {};
  const DATO_TID = new Set(['ki_vvb_siste_godkjente_syklus', 'ki_vvb_oppvarming_startet', 'ki_vvb_boost_til', 'ki_hjemkomst_planlagt']);
  // input_* fra pakke-tiden → integrasjonens domener (mapId i JS-kortet)
  const mapDom = (id) => {
    if (!id || typeof id !== 'string') return id;
    const [dom, obj] = id.split('.');
    if (dom === 'input_boolean') return `switch.${obj}`;
    if (dom === 'input_number') return `number.${obj}`;
    if (dom === 'input_text') return `text.${obj}`;
    if (dom === 'input_datetime') return `${DATO_TID.has(obj) ? 'datetime' : 'time'}.${obj}`;
    return id;
  };
  // … og deretter til den FAKTISKE entitets-ID-en fra registeret (fiks 15.12): «sensor.ki_energi_status» kan hete
  // «sensor.ki_energi_status_2» (kollisjon med pakke-/pyscript-sensoren ved installasjon) eller være omdøpt av brukeren.
  // Oppslaget (KI.ids) bygges fra siste hass (billig: bygges bare på nytt når hass.entities byttes eller registeret er hentet).
  const mapId = (id) => {
    const d = mapDom(id);
    if (!d || typeof d !== 'string') return d;
    if (M.lastHass) kiIndex(M.lastHass);
    return KI.ids.get(d) || d;
  };

  /* ================================================================ KI Energi i registeret (fiks 15.12) */
  // Integrasjonen (entity.py): entity_id = <domene>.<nøkkel>, unique_id = "ki_energi_<nøkkel>", platform = "ki_energi",
  // ingen translation_key. Oppslaget bygges fra hass.entities (platform === 'ki_energi'); unique_id brukes når den finnes
  // der (eldre/andre frontend-versjoner) eller fra config/entity_registry/list (reserve, én gang). Uten unique_id godtas
  // HAs kollisjonssuffiks (_2, _3 …) når grunn-ID-en ikke selv finnes.
  const DOMENE = 'ki_energi', STATUS = 'sensor.ki_energi_status';
  const KI = { ents: undefined, built: -1, ver: 0, ids: new Map(), n: 0, avvik: false, reg: null, regAsked: false, entry: undefined, entryAsked: false, logged: false, cards: new Set() };
  const uidKey = (u) => (typeof u === 'string' && u.startsWith(DOMENE + '_') ? u.slice(DOMENE.length + 1) : null);
  function kiBuild(hass) {
    const ents = hass && hass.entities;
    const list = [];
    if (ents) Object.keys(ents).forEach((id) => { const e = ents[id]; if (e && e.platform === DOMENE) list.push({ ...e, entity_id: e.entity_id || id }); });
    // Registeret over WS (reserve) har unique_id; fyll inn / legg til
    if (Array.isArray(KI.reg)) {
      const byId = new Map(list.map((e) => [e.entity_id, e]));
      KI.reg.forEach((r) => { if (!r || r.platform !== DOMENE || r.disabled_by) return; const e = byId.get(r.entity_id); if (e) { if (e.unique_id == null) e.unique_id = r.unique_id; if (e.translation_key == null) e.translation_key = r.translation_key; } else list.push(r); });
    }
    const ids = new Map(), egne = new Set(list.map((e) => e.entity_id));
    // 1) unique_id / translation_key → nøyaktig
    list.forEach((e) => {
      const dom = String(e.entity_id).split('.')[0], k = uidKey(e.unique_id);
      if (k && `${dom}.${k}` !== e.entity_id) ids.set(`${dom}.${k}`, e.entity_id);
      if (e.translation_key && !egne.has(`${dom}.${e.translation_key}`) && !ids.has(`${dom}.${e.translation_key}`)) ids.set(`${dom}.${e.translation_key}`, e.entity_id);
    });
    // 2) uten unique_id: HAs kollisjonssuffiks
    list.forEach((e) => {
      if (uidKey(e.unique_id)) return;
      const m = /^(.+?)_\d+$/.exec(e.entity_id);
      if (m && !egne.has(m[1]) && !ids.has(m[1])) ids.set(m[1], e.entity_id);
    });
    // Oppslaget skal aldri peke vekk fra en ID som selv er integrasjonens
    egne.forEach((id) => ids.delete(id));
    // Tegn på avvikende ID-er uten unique_id i hass.entities (kollisjonssuffiks, eller omdøpt vekk fra ki_/vvb_-mønsteret)
    // → registeret hentes over WS for å få unique_id. Regnes én gang per hass.entities, ikke per oppslag.
    const avvik = list.some((e) => { if (e.unique_id) return false; const o = String(e.entity_id).split('.')[1] || ''; return /_\d+$/.test(o) || !/^(ki_|vvb_)/.test(o); });
    KI.ids = ids; KI.n = list.length; KI.ents = ents; KI.built = KI.ver; KI.avvik = avvik;
  }
  function kiIndex(hass) {
    if (!hass) return KI;
    if (hass.entities !== KI.ents || KI.built !== KI.ver) kiBuild(hass);
    if (!KI.entryAsked || !KI.regAsked) kiAsk(hass);
    return KI;
  }
  const kiBump = () => { KI.ver++; KI.cards.forEach((c) => { if (c.isConnected) { if (c.update) c.update(); } else KI.cards.delete(c); }); };
  // Reserve-oppslag over WS (én gang per økt): config entry for loggen/«installert», registeret når statussensoren
  // ikke kan finnes via hass.entities.
  function kiAsk(hass) {
    if (!hass || typeof hass.callWS !== 'function') { kiLog(hass); return; }
    if (!KI.entryAsked) {
      KI.entryAsked = true;
      Promise.resolve().then(() => hass.callWS({ type: 'config_entries/get', domain: DOMENE }))
        .then((r) => { KI.entry = Array.isArray(r) ? (r.find((e) => e && e.domain === DOMENE) || null) : undefined; })
        .catch((e) => { console.warn('msh-klima-card', 'config_entries/get', e); KI.entry = undefined; })
        .then(() => { kiLog(M.lastHass || hass); kiBump(); });
    }
    // Registeret hentes bare når noe tyder på avvikende ID-er: statussensoren er ikke funnet, eller en ki_energi-entitet
    // har kollisjonssuffiks / et navn som ikke følger integrasjonens mønster (omdøpt av brukeren) og mangler unique_id.
    const funnet = (hass.states && hass.states[STATUS] && (!hass.entities || !hass.entities[STATUS] || hass.entities[STATUS].platform === DOMENE)) || KI.ids.has(STATUS);
    if (!KI.regAsked && (!funnet || KI.avvik)) {
      KI.regAsked = true;
      Promise.resolve().then(() => hass.callWS({ type: 'config/entity_registry/list' }))
        .then((r) => { if (Array.isArray(r)) { KI.reg = r.filter((e) => e && e.platform === DOMENE); kiBump(); } })
        .catch((e) => { console.warn('msh-klima-card', 'config/entity_registry/list (ikke admin?) – bruker hass.entities', e); });
    }
  }
  function kiLog(hass) {
    if (KI.logged || !hass) return;
    KI.logged = true;
    const st = hass.states && hass.states[mapId(STATUS)];
    console.info('msh-klima-card', window.KI_MSH_VERSION || '', { entry: !!KI.entry, entiteter: KI.n, status: st ? st.state : null });
  }
  // Status for heroen og «Venter på KI Energi» (4 · bare når integrasjonen mangler eller status er utilgjengelig)
  M.kiEnergi = function (card) {
    const hass = (card && (card.hass || card._hass)) || M.lastHass || null;
    kiIndex(hass);
    if (card && card.isConnected !== undefined) KI.cards.add(card);
    const statusId = mapId(STATUS), s = hass && hass.states ? hass.states[statusId] || null : null;
    const installert = !!KI.entry || KI.n > 0 || !!s;
    return { installert, entry: KI.entry || null, entiteter: KI.n, statusId, status: s, venter: !installert || !s || s.state === 'unavailable', ids: KI.ids };
  };
  M.klimaMapId = mapId;
  M.KI_ENERGI_OPPSETT = '/config/integrations/integration/ki_energi';
  const TJENESTER = {
    'pyscript.ki_overstyr': ['ki_energi', 'overstyr'],
    'pyscript.ki_fjern_overstyring': ['ki_energi', 'fjern_overstyring'],
    'pyscript.ki_nullstill_laering': ['ki_energi', 'nullstill_laering'],
    'script.ki_vvb_boost': ['ki_energi', 'vvb_boost'],
    'script.ki_vvb_avbryt_boost': ['ki_energi', 'vvb_avbryt_boost'],
    'script.ki_vvb_tving_syklus_na': ['ki_energi', 'vvb_tving_syklus'],
    'script.ki_sett_standardverdier': ['ki_energi', 'sett_standardverdier'],
  };
  const SONE_TEKST = { gronn: 'God margin', gul: 'Nærmer seg grensen', oransje: 'Liten margin', rod: 'Fare for ny topp', kritisk: 'Kritisk', fallback: 'Trygg fallback', av: 'Motoren er av' };
  const HANDLING = {
    normal: { tekst: 'Normal', k: 'ok' }, senket: { tekst: 'Senket', k: 'advarsel' }, vindu: { tekst: 'Vindu åpent', k: 'feil' },
    venter: { tekst: 'Venter på tur', k: 'advarsel' }, manuell: { tekst: 'Manuell', k: 'noytral' }, utilgjengelig: { tekst: 'Utilgjengelig', k: 'feil' },
    utsatt: { tekst: 'Utsatt', k: 'advarsel' }, 'på': { tekst: 'På', k: 'ok' }, av: { tekst: 'Av', k: 'noytral' },
  };
  const HJELP = {
    venter_svar: 'Søndag morgen spør systemet om dere kommer hjem. Fram til du svarer, eller til svarfristen går ut, står dette på «Ja». Svarer du ikke, avsluttes helgemodus automatisk ved fristen, slik at huset er varmt når dere kommer.',
    beredskap: 'En sjekk før du lar motoren overta: at den rapporterer status, at den har funnet en timesmåler, at tidskonstantene har nok målinger bak seg, og at ingen ovner står avslått. «Lærer fortsatt» betyr at den fungerer, men at nattsenkingsvurderingene ennå bygger på standardverdier.',
    skyggemodus: 'Motoren regner ut alt og skriver til loggen, men rører ingen ovner. Slik kan du lese beslutningene i noen uker og se om du er enig før huset merker dem. Varmtvann, håndklevarmer og gardiner styres uansett.',
    dynamisk_grense: 'Elvia fakturerer etter snittet av de tre høyeste døgnmaksene fra tre ulike dager. Motoren måler hver hele klokketime selv, husker døgnmaks per dato, og regner ut hvor høyt DAGENS døgnmaks kan bli uten at snittet passerer ønsket trinn (minus reserve). Timer opp til dagens allerede registrerte døgnmaks koster ingenting ekstra og senker ingen ovner. Den absolutte timegrensen gjelder alltid i tillegg. Registrerte tall og prognoser holdes adskilt.',
    tariff: 'Øvre grense i kW → fastledd kr/mnd inkl. avgifter, f.eks. «2:150,5:250,10:420». Nøyaktig på grensen regnes som trinnet over. Snitt over siste grense = ukjent trinn (motoren finner ikke på satser, og styrer da etter absolutt grense).',
    tillatt_effekt: 'Gjenstående kWh delt på gjenstående tid av timen. Verdien er kuttet ved timegrensen og regner aldri med mindre enn et kvarter igjen — ellers ville de siste minuttene av en rolig time gitt et vanvittig høyt tall som ovnene uansett ikke rekker å bruke.',
    uregulert: 'Alt huset bruker som motoren ikke styrer: komfyr, oppvaskmaskin, elektronikk, lading. Regnes som total effekt minus summen av det den styrer. Dette er grunnlaget for hele prognosen.',
    tidskonstant: 'Hvor lenge rommet holder på overtemperaturen sin. Måles ved å se hvor fort det kjøles ned når varmen er av. Lang tidskonstant betyr at nattsenking sjelden lønner seg, fordi gjenoppvarmingen skjer til dyrere dagtariff.',
    komfortvekt: 'Hvor tungt et temperaturavvik veier mot prioriteten når budsjettet fordeles. Høyt tall gjør at et kaldt rom med lav prioritet likevel går foran et rom som allerede er varmt.',
    shed: 'Hvor mange grader motoren får senke når budsjettet ikke strekker til. Gulvvarme tåler mer enn panelovner, fordi tregheten gjør at det ikke merkes i rommet på kort sikt.',
    vvb_terskel: 'Hvor mange watt som må til før en oppvarming regnes som reell. Står den for lavt, telles standby som en fullført syklus, og legionellasikringen blir bekreftet på falskt grunnlag.',
    vvb_billige: 'Marginalprisen er energipris pluss energiledd. Under Norgespris er energiprisen flat, så det er bare nettleiens dag- og nattskille som skiller timene — rangeringen faller derfor naturlig ned på natt og helg.',
    vvb_handling: 'Berederen har ingen temperatursensor. Systemet bekrefter legionellasikring ved å se et fullført på→av-forløp, som betyr at termostaten nådde settpunktet. Det forutsetter at termostaten fysisk står på 65–70 °C — det kan ikke Home Assistant kontrollere. Energimotoren skriver aldri til berederen; den reserverer bare effekt.',
    vvb_syklus: 'Berederen har ingen temperatursensor, men den har en termostat. Når bryteren står på og effekten faller til null, har termostaten koblet ut fordi vannet har nådd settpunktet. Det kalles metning, og er en direkte måling av at berederen er ferdig — også for legionella, forutsatt at termostaten fysisk står på 65–70 grader. Et ødelagt element gir samme signatur, så systemet krever at den HAR trukket effekt først. Har den aldri gjort det, er det en feil og ikke metning.',
    gardiner: 'I fyringssesongen lukkes gardinene når sola er nede for å begrense varmetapet gjennom glassveggen, og åpnes på dagen for gratis solvarme. Er det bitende kaldt holdes de lukket også på dagen. Utenfor sesongen styres de bare i sommermodus, da som solskjerming.',
    handkle: 'Klimastyringen eier denne bryteren. Når «KI styrer» er av, slås håndklevarmeren på igjen automatisk hver gang den går av — den er da ment å stå på konstant. Slå på KI-styring for å bruke tidsvinduene i stedet.',
    overtakelse: 'Motoren er den eneste som skriver til ovnene. Bryteren er det motsatte av skyggemodus: på betyr at den faktisk setter settpunkt, av betyr at den bare regner og logger. Soner med «KI styrer» av røres aldri uansett.',
    lagring: 'Innlærte lastprofiler, tidskonstanter, overstyringer og beslutningslogg lagres i Home Assistants .storage-mappe og overlever omstart og oppdatering av integrasjonen.',
    malekilde: 'Forbruk denne timen måles direkte mot strømmålerens energiregister — motoren husker verdien ved timeskiftet og trekker fra. Svarer ikke registeret, brukes et anslag fra øyeblikkseffekt, som er merkbart mindre presist.',
    lys: 'Glemt lys: med bevegelses-/nærværssensor slås lyset av først når rommet har vært tomt i valgt antall minutter — aldri mens noen er der. Uten sensor slås det av etter lang sammenhengende på-tid, bare innenfor tidsvinduet (standard 08–22). Nattdemping: lysstyrken settes én gang ved natt og én gang ved dag; endrer du den manuelt, lar KI den stå til neste overgang. Besparelsen anslås fra oppgitt effekt.',
    adaptiv: 'To reserver: den strategiske (kWh på døgnmaks) holder månedens topp-tre-snitt unna neste trinn og brukes i Dynamisk grense. Usikkerhetsmarginen (kWh på timens sluttforbruk) læres av hvor mye forbruket har blitt høyere enn prognosen (P80 av feilene, per hvor mange minutter som var igjen, og etter tid på døgnet/hverdag-helg når det er nok data). Den trekkes fra tilgjengelig effekt i stedet for den faste reserven — aldri begge, og aldri inn i nettleie-regnestykket. Øker raskt, synker sakte. Timer der motoren selv senket etter at prognosen ble laget, holdes utenfor.',
    sparing: 'Anslag uten kontrollgruppe. Varmestyring: motorens egen statistikk (flyttet energi × nettleie-differanse, unngåtte topper, litt spart kWh). Gardiner: varmetap gjennom glasset = U × areal × temperaturforskjell; lukket gardin regnes som 30 % mindre tap om natten — «kunne spart» er det samme for timer de sto åpne. Håndklevarmer: mot å stå på hele døgnet. Bereder: kWh varmet i nattvinduet × forskjellen i energiledd.',
    handlinger: 'Entiteter og husets data endres under Innstillinger → Integrasjoner → KI Energi → Konfigurer. Nullstilling av tidskonstanter betyr at motoren må lære huset på nytt, og at nattsenkingen faller tilbake på standardverdier i mellomtiden — bruk det bare hvis tallene ser åpenbart feil ut.',
    leggetid: 'Starter kveldssenkingen i rommet med én gang, i stedet for å vente til fast leggetid. Rommet varmes opp igjen til vanlig vekketid. Trykk igjen for å avbryte.',
    standardverdier: 'Setter alle innstillinger tilbake til de anbefalte utgangsverdiene. Entiteter og husets data ligger i integrasjonens konfigurasjon og røres ikke.',
  };
  const HYTTE = {
    'Helgemodus': 'Tom hytte (frostsikring)', 'Hjemkomst': 'Ankomst', 'Start hjemkomst': 'Start ankomst', 'Avslutt hjemkomst': 'Avslutt ankomst',
    'Forventet hjemkomst': 'Ankomst fredag kl.', 'Helgetemperatur': 'Frosttemperatur', 'Helg gulvvarme': 'Frost gulvvarme', 'Helg bad': 'Frost bad',
    'Helg automatisk ved fravær': 'Frostsikring når hytta er tom', 'Torsdag/fredag etter lengre fravær': 'Uansett ukedag, etter «Helg auto etter»-timer',
    'Helg senk gulvvarme': 'Frost senk gulvvarme', 'Alle borte': 'Hytta tom',
  };

  /* ================================================================ farger */
  const G = 'var(--green, rgb(102 209 158))', Y = 'var(--yellow, rgb(242 210 111))', OR = 'var(--orange, rgb(242 181 115))';
  const R = 'var(--red, rgb(242 128 115))', B = 'var(--blue, rgb(115 185 242))', P = 'var(--pink, rgb(242 133 201))', PU = 'var(--purple, rgb(173 153 230))';
  const PINK = 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)';
  const TONE = { ok: G, advarsel: OR, feil: R, noytral: 'var(--ki-text-mid, #979797)', info: B, gul: Y };
  const al = (c, a) => `color-mix(in srgb, ${c} ${Math.round(a * 100)}%, transparent)`;
  // Del A pkt. 6: aksent brukt som TEKST/ikon mørknes i lys modus (MSH.theme.accentText); flater/fyll beholder aksenten
  //   I lys modus ligger teksten ofte på en tonet chip/innerflate (#dedede), så den mørknes 25 % til (--ki-tone-k = 1,5 bare i
  //   lys modus → 75 % aksent + 25 % svart; mørk: 100 % = uendret).
  const at = (c) => (c && M.theme && M.theme.accentText ? `color-mix(in srgb, ${M.theme.accentText(c)} calc(100% - (var(--ki-tone-k, 1) - 1) * 50%), black)` : c);

  /* ================================================================ kontekst (oppslag via mapId) */
  // Ett oppslagsobjekt per render. card.s(id) registrerer avhengigheten, så kortet tegnes på nytt når
  // tilstandsobjektet byttes (også ved bare attributt-endring – sammenligning på referanse som i JS-kortet).
  function ctx(card) {
    const hass = (card && (card.hass || card._hass)) || M.lastHass || null;
    kiIndex(hass);
    const st = (id) => {
      if (!id || !hass) return null;
      const m = mapId(id);
      if (card && typeof card.s === 'function') return card.s(m);
      return hass.states[m] || null;
    };
    const K = {
      hass, card, mapId, st,
      s(id, d = '–') { const s = st(id); return s && !['unknown', 'unavailable'].includes(s.state) ? s.state : d; },
      n(id, d = NaN) { const s = st(id); const v = s ? Number(s.state) : NaN; return s && s.state !== '' && isFinite(v) ? v : d; },
      a(id, k, d) { const s = st(id); return s && s.attributes && s.attributes[k] !== undefined ? s.attributes[k] : d; },
      pa(id) { const s = st(id); return !!s && s.state === 'on'; },
      get hytte() { return K.a('sensor.ki_energi_status', 'hustype', 'bolig') === 'fritidsbolig'; },
      get personer() { return K.a('sensor.ki_energi_status', 'personer', []) || []; },
      ent(k) { return (K.a('sensor.ki_energi_status', 'entiteter', {}) || {})[k] || ''; },
      har(f) { return !!K.a('sensor.ki_energi_status', f, true); },
      harLading() {
        const flagg = K.a('sensor.ki_energi_status', 'lading', null);
        if (flagg !== null && flagg !== undefined) return !!flagg;
        const s = st('sensor.ki_lading_status');
        return !!s && !['ingen', 'unavailable', 'unknown'].includes(s.state);
      },
      laster() { return K.a('sensor.ki_laster', 'laster', []) || []; },
      l(t) { return K.hytte ? (HYTTE[t] || t) : t; },
      kall(domene, tjeneste, data = {}) { return kall(hass, domene, tjeneste, data); },
    };
    return K;
  }
  // Alle tjenestekall går her, så domener og entitets-ID-er oversettes ett sted (_kall i JS-kortet).
  function kall(hass, domene, tjeneste, data = {}) {
    const n = TJENESTER[`${domene}.${tjeneste}`];
    if (n) [domene, tjeneste] = n;
    if (domene === 'input_boolean') domene = 'switch';
    else if (domene === 'input_number') { domene = 'number'; tjeneste = 'set_value'; }
    else if (domene === 'input_text') { domene = 'text'; tjeneste = 'set_value'; }
    else if (domene === 'input_datetime') {
      const obj = String(data.entity_id || '').split('.')[1];
      domene = DATO_TID.has(obj) ? 'datetime' : 'time';
      tjeneste = 'set_value';
      if (domene === 'time') data = { entity_id: data.entity_id, time: data.time };
      else data = { entity_id: data.entity_id, datetime: data.datetime || data.timestamp };
    }
    if (data.entity_id) data = Object.assign({}, data, { entity_id: mapId(data.entity_id) });
    return M.call(hass, domene, tjeneste, data);
  }

  /* ================================================================ korttilstand (ikke config) */
  function S(card) {
    if (!card.__kb) card.__kb = { help: new Set(), ov: {}, zone: null, zgraf: {}, mnd: null, armed: null, hist: {}, pending: {}, graphs: {}, eopen: new Set(), open: false, pend: {} };
    return card.__kb;
  }
  const uiGet = (card, k, d) => { const u = card.ui || card._ui || {}; return u[k] !== undefined ? u[k] : d; };
  const uiSet = (card, p) => { if (card.setUI) card.setUI(p); else { card._ui = { ...(card._ui || {}), ...p }; card.update && card.update(); } };
  const collapsedMap = (card) => uiGet(card, 'klima_collapsed', {}) || {};
  const isCollapsed = (card, key, def = false) => { const m = collapsedMap(card); return m[key] !== undefined ? !!m[key] : def; };

  /* ================================================================ radtyper */
  const dotHTML = (k) => (k ? `<span class="kb-dot" style="background:${TONE[k] || k}"></span>` : '');
  const chipHTML = (t, k) => `<span class="kb-chip" style="color:${at(TONE[k] || k) || 'var(--ki-text-mid, #979797)'};background:${al(TONE[k] || k || 'var(--ki-text-mid, #979797)', 0.18)}">${esc(t)}</span>`;
  const helpBtn = (card, id, cls = '') => (HJELP[id] ? `<button type="button" class="kb-q sm${S(card).help.has('r:' + id) ? ' on' : ''} ${cls}" data-act="k-help" data-k="r:${esc(id)}" aria-label="Forklaring">?</button>` : '');
  const helpBox = (card, id, extra = '') => (S(card).help.has('r:' + id) && HJELP[id] ? `<div class="kb-help">${esc(HJELP[id])}${extra ? `<div style="margin-top:6px">${esc(extra)}</div>` : ''}</div>` : '');
  // Info-rad: prikk · navn (+ chip) · undertekst · verdi. o.act/o.data gjør raden trykkbar, o.ent gir hold → more-info.
  function row(o) {
    const data = Object.entries(o.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
    const tap = o.act ? ` data-act="${o.act}" role="button" tabindex="0"` : '';
    const sw = o.tog === undefined || o.tog === null ? '' : `<span class="kb-sw${o.tog ? ' on' : ''}${o.missing ? ' miss' : ''}"><i></i></span>`;
    return `<div class="kb-row${o.act ? ' tap' : ''}${o.cls ? ' ' + o.cls : ''}"${tap}${data}${o.ent ? ` data-ent="${esc(o.ent)}"` : ''}${o.haptic ? ` data-haptic="${o.haptic}"` : ''}>
      ${dotHTML(o.dot)}
      <div class="kb-rt"><div class="kb-rn">${o.nameHtml != null ? o.nameHtml : esc(o.name)}${o.chip ? chipHTML(o.chip[0], o.chip[1]) : ''}${o.missing ? chipHTML('mangler', 'feil') : ''}${o.after || ''}</div>
        ${o.sub ? `<div class="kb-rs">${o.subHtml ? o.sub : esc(o.sub)}</div>` : ''}</div>
      ${o.v != null && o.v !== '' ? `<span class="kb-rv${o.pill ? ' pill' : ''}">${o.vHtml ? o.v : esc(o.v)}</span>` : ''}${sw}
    </div>`;
  }
  const list = (rows) => { const r = rows.filter(Boolean).join(''); return r ? `<div class="kb-list">${r}</div>` : ''; };
  // Bryter (veksle i JS-kortet): input_boolean/switch via _kall; 'bryter' = fysisk switch direkte.
  function tog(K, card, id, name, sub, o = {}) {
    const s = K.st(id);
    const on = !!s && s.state === 'on';
    return row({ name, sub, tog: on, missing: !s, act: s ? 'k-tog' : null, data: { id, kind: o.kind || 'veksle' }, ent: s ? mapId(id) : null, after: o.help ? helpBtn(card, o.help) : '', cls: o.cls, haptic: 'selection' })
      + (o.help ? helpBox(card, o.help) : '');
  }
  // Stepper (− verdi +) for number/time-entiteter med entitetens min/max/step (MSH.stepperHTML, 09-pickers.js).
  function step(K, card, id, label, dec = 0, unit = '', o = {}) {
    const mid = mapId(id);
    const s = K.st(id);
    const st = s && s.attributes ? Number(s.attributes.step) : NaN;
    const sd = isFinite(st) && st < 1 ? (String(st).split('.')[1] || '').length : 0;
    const opts = { unit: String(unit || '').trim(), decimals: Math.max(dec, sd), key: 'stp-' + mid };
    if (o.jump) opts.jump = o.jump;
    const ctl = M.stepperHTML ? M.stepperHTML(K.hass, mid, opts) : stepFallback(K, mid, opts);
    return `<div class="kb-row kb-srow"${s ? ` data-ent="${esc(mid)}"` : ''}>
      <div class="kb-rt"><div class="kb-rn">${esc(label)}${s ? '' : chipHTML('mangler', 'feil')}${o.help ? helpBtn(card, o.help) : ''}</div>${o.sub ? `<div class="kb-rs">${esc(o.sub)}</div>` : ''}</div>${ctl}</div>`
      + (o.help ? helpBox(card, o.help) : '');
  }
  // Midlertidig reserve til 09-pickers.js finnes (samme data-attributter, egen handling k-step/k-num/k-time).
  function stepFallback(K, mid, o) {
    const s = K.hass && K.hass.states[mid];
    const dom = mid.split('.')[0];
    const dead = !s || ['unknown', 'unavailable'].includes(s.state);
    let disp = '–', field = '';
    if (!dead && dom === 'time') { disp = String(s.state).slice(0, 5); field = `<input class="kb-nat" type="time" step="60" value="${esc(disp)}" data-input="k-time" data-id="${esc(mid)}">`; }
    else if (!dead && dom === 'datetime') { disp = String(s.state).slice(0, 16).replace('T', ' '); field = ''; }
    else if (!dead) {
      const v = Number(s.state), a = s.attributes || {}, stp = Number(a.step) || 1, mn = Number(a.min ?? v - 50 * stp), mx = Number(a.max ?? v + 50 * stp);
      disp = nf(v, o.decimals) + (o.unit ? (o.unit === '%' || o.unit === '°' ? '' : ' ') + o.unit : '');
      const n = Math.min(300, Math.round((mx - mn) / stp) + 1), opts = [];
      for (let i = 0; i < n; i++) { const x = Number((mn + i * stp).toFixed(6)); opts.push(`<option value="${x}"${Math.abs(x - v) < stp / 2 ? ' selected' : ''}>${nf(x, o.decimals)}</option>`); }
      field = `<select class="kb-nat" data-input="k-num" data-id="${esc(mid)}">${opts.join('')}</select>`;
    }
    const b = (d, ic) => `<button type="button" class="kb-stb" data-act="k-step" data-id="${esc(mid)}" data-dir="${d}" data-haptic="selection"${dead ? ' disabled' : ''}>${M.icon(ic, 18)}</button>`;
    return `<div class="kb-stp${dead ? ' dis' : ''}">${b(-1, 'mdi:minus')}<span class="kb-stv"><span>${esc(disp)}</span>${field}</span>${b(1, 'mdi:plus')}</div>`;
  }
  const stats = (items, cols) => `<div class="kb-stats" style="grid-template-columns:repeat(${cols || (items.length === 4 ? 4 : Math.min(3, items.length || 1))},minmax(0,1fr))">${items.map(([v, k, o]) => `<div class="kb-stat${o && o.act ? ' tap' : ''}"${o && o.act ? ` data-act="${o.act}" data-id="${esc(o.id)}"` : ''}${o && o.ent ? ` data-ent="${esc(o.ent)}"` : ''}><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>`;
  const note = (t, html) => (t ? `<div class="kb-note">${html ? t : esc(t)}</div>` : '');
  const warn = (t) => `<div class="kb-warn">${M.icon('mdi:alert-outline', 16)}<span>${esc(t)}</span></div>`;
  const big = (v, unit) => `<div class="kb-big"><b>${esc(v)}</b><span>${esc(unit)}</span></div>`;
  const concl = (t) => (t ? `<div class="kb-concl">${esc(t)}</div>` : '');
  const sub = (t) => `<div class="kb-sub">${esc(t)}</div>`;
  const facts = (items) => { const f = items.filter(Boolean); return f.length ? `<div class="kb-facts">${f.join('')}</div>` : ''; };
  const fact = (t, k) => (k ? chipHTML(t, k) : `<span class="kb-fact">${esc(t)}</span>`);
  // Knapper. Tjeneste: {label, dom, svc, data, ok}. Farlig: {danger:true} → to trykk (3 s), rød «Trykk igjen».
  function btn(card, o) {
    const kb = S(card);
    const key = o.key || `${o.dom}.${o.svc}.${JSON.stringify(o.data || {})}`;
    const armed = o.danger && kb.armed && kb.armed.k === key && Date.now() < kb.armed.until;
    return `<button type="button" class="kb-btn${armed ? ' armed' : ''}${o.danger ? ' danger' : ''}${o.on ? ' on' : ''}" data-act="${o.danger ? 'k-danger' : 'k-svc'}" data-haptic="off" data-k="${esc(key)}" data-dom="${esc(o.dom || '')}" data-svc="${esc(o.svc || '')}" data-json="${esc(JSON.stringify(o.data || {}))}" data-ok="${esc(o.ok || 'Sendt')}">${o.icon ? M.icon(o.icon, 18) : ''}<span>${esc(armed ? 'Trykk igjen' : o.label)}</span></button>`;
  }
  const btns = (card, items) => { const b = items.filter(Boolean); return b.length ? `<div class="kb-btns">${b.map((o) => btn(card, o)).join('')}</div>` : ''; };
  const seg = (items, cur, act, extra = '') => `<div class="kb-seg">${items.map(([id, label, icon, dis]) => `<button type="button" class="${id === cur ? 'on' : ''}" data-act="${act}" data-v="${esc(id)}"${extra}${dis ? ' disabled' : ''}>${icon ? M.icon(icon, 18) : ''}<span>${esc(label)}</span></button>`).join('')}</div>`;
  // Sammenleggbar underseksjon (_sub): husker posisjonen som blokkene.
  function subsec(card, id, title, html, openDef = false, extra = '') {
    const open = !isCollapsed(card, 'sub:' + id, !openDef);
    return `<div class="kb-subsec${open ? '' : ' is-col'}"><div class="kb-subh" data-act="k-coll" data-k="sub:${esc(id)}" data-def="${openDef ? 0 : 1}" role="button"><span>${esc(title)}</span>${extra}${M.icon('mdi:chevron-down', 18, 'transition:transform .2s')}</div>${open ? `<div class="kb-subb">${html}</div>` : ''}</div>`;
  }

  /* ================================================================ tid og dato */
  const minOf = (K, id) => { const s = K.st(id); if (!s) return null; const m = /^(\d{1,2}):(\d{2})/.exec(s.state); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  const klMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const tidKort = (K, id) => { const s = K.st(id); return s && /^\d/.test(s.state) ? String(s.state).slice(0, 5) : '–'; };
  function dato(iso) {
    if (!iso) return '–';
    const d = new Date(iso);
    if (isNaN(d)) return '–';
    const dag = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'][d.getDay()];
    const mnd = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'][d.getMonth()];
    const kl = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const i = new Date(); const diff = Math.round((d - new Date(i.getFullYear(), i.getMonth(), i.getDate())) / 86400000);
    const naar = diff === 0 ? 'i dag' : diff === 1 ? 'i morgen' : diff === -1 ? 'i går' : `${dag} ${d.getDate()}. ${mnd}`;
    return `${naar} kl. ${kl}`;
  }
  const klokke = (iso) => { if (!iso) return '–'; const d = new Date(iso); return isNaN(d) ? '–' : `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  // Døgnbånd (_dognplan): én rad per ting, fargede spenn med tekst, hvit strek = nå, akse 00–24. Over midnatt deles i to.
  const SPENN = { dag: Y, ok: G, s: B, c: PU, borte: 'var(--ki-text-mid, #7f7f7f)', advarsel: OR, noytral: 'var(--ki-text-mid, #979797)', feil: R };
  function dognplan(K, rader) {
    const naa = new Date(), naaMin = naa.getHours() * 60 + naa.getMinutes();
    const pct = (m) => (m / 1440 * 100).toFixed(2);
    const rad = (r) => {
      const sp = (r.spenn || []).map(([fra, til, k, tekst]) => {
        const a = minOf(K, fra), b = minOf(K, til);
        if (a == null || b == null) return '';
        const t = `${tekst || ''} ${klMin(a)}–${klMin(b)}`.trim();
        const c = SPENN[k] || P;
        const boks = (l, w) => `<span class="kb-dp-sp" style="left:${pct(l)}%;width:${pct(w)}%;background:${al(c, 0.55)}" title="${esc(t)}">${w > 90 ? esc(t) : ''}</span>`;
        return b >= a ? boks(a, b - a) : boks(a, 1440 - a) + boks(0, b);
      }).join('');
      const mk = (r.mark || []).map(([id, tekst, k]) => {
        const m = minOf(K, id);
        if (m == null) return '';
        return `<span class="kb-dp-mk" style="left:${pct(m)}%;background:${SPENN[k] || 'var(--ki-text, #fafafa)'}" title="${esc(tekst)} ${klMin(m)}"></span><span class="kb-dp-ml" style="${m > 1080 ? `right:${(100 - pct(m)).toFixed(2)}%` : `left:${pct(m)}%`}">${esc(tekst)} ${klMin(m)}</span>`;
      }).join('');
      return `<div class="kb-dp-r"><span class="kb-dp-n">${esc(r.navn)}</span><div class="kb-dp-t">${sp}${mk}<span class="kb-dp-now" style="left:${pct(naaMin)}%"></span></div></div>`;
    };
    return `<div class="kb-dp">${rader.map(rad).join('')}<div class="kb-dp-ax"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div></div>`;
  }

  // 12-måneders stripe (_manedStripe): [fra .. til] markert, kan gå over nyttår. Trykk start, så slutt – eller dra.
  const MND = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];
  function manedStripe(K, card, fraId, tilId, etikett) {
    const fra = Math.round(K.n(fraId)), til = Math.round(K.n(tilId));
    const naa = new Date().getMonth() + 1;
    const inne = (m) => isFinite(fra) && isFinite(til) && (fra <= til ? (m >= fra && m <= til) : (m >= fra || m <= til));
    const kb = S(card);
    const venter = kb.mnd && kb.mnd.fraId === fraId ? kb.mnd.fra : null;
    const kort = (m) => MND[m - 1] || '–';
    const periode = isFinite(fra) && isFinite(til) ? `${kort(fra)}–${kort(til)}` : '–';
    const ok = K.st(fraId) && K.st(tilId);
    return `<div class="kb-ms${ok ? '' : ' dis'}" data-kms="1" data-fra="${esc(fraId)}" data-til="${esc(tilId)}">${MND.map((b, i) => `<span class="kb-mo${inne(i + 1) ? ' in' : ''}${i + 1 === naa ? ' now' : ''}${venter === i + 1 || (venter == null && i + 1 === fra && isFinite(til)) ? ' start' : ''}" data-m="${i + 1}">${b}</span>`).join('')}</div>
      <div class="kb-note">${esc(etikett || 'Aktiv')}: ${esc(periode)} · ${venter ? `start satt til ${esc(kort(venter))} — trykk sluttmåned` : 'trykk start, så slutt (eller dra)'}</div>`;
  }

  /* ================================================================ historikk (bare når popupen er åpen) */
  function hist(card, K, ids, hours) {
    const kb = S(card);
    ids = [...new Set(ids.filter(Boolean).map(mapId))].filter((id) => K.hass && K.hass.states[id]);
    if (!ids.length) return {};
    const key = ids.join(',') + '|' + hours;
    const c = kb.hist[key];
    const open = kb.open || card.isOpen;
    if ((!c || Date.now() - c.t > 300000) && open && !kb.pending[key] && M.history) {
      kb.pending[key] = true;
      M.history(K.hass, ids, hours).then((d) => {
        kb.hist[key] = { t: Date.now(), d: d || {} };
        delete kb.pending[key];
        if (kb.drag) kb.dirty = true; else if (kb.open || card.isOpen) card.update && card.update();
      }).catch((e) => { console.warn('msh-klima-card', e); delete kb.pending[key]; });
    }
    return c ? c.d : null;
  }
  // Tidsvektet snitt av en trinnserie [{t,v}] (ms) i [a,b].
  function twMean(pts, a, b) {
    if (!pts || !pts.length || b <= a) return null;
    let cur = null, sum = 0, dur = 0, last = a;
    for (const p of pts) {
      if (p.t <= a) { cur = p.v; continue; }
      if (p.t >= b) break;
      if (cur != null) { sum += cur * (p.t - last); dur += p.t - last; }
      cur = p.v; last = p.t;
    }
    if (cur != null) { sum += cur * (b - last); dur += b - last; }
    return dur > 0 ? sum / dur : null;
  }
  const buckets = (pts, n, hours) => { const end = Date.now(), len = hours * 3600000 / n; return Array.from({ length: n }, (_, i) => twMean(pts, end - (n - i) * len, end - (n - i - 1) * len)); };
  const bucketLabel = (i, n, hours) => { const d = new Date(Date.now() - (n - i - 1) * hours * 3600000 / n); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  // Søyler med skrubb. bars: [{h (0..100), c (farge), c2?, h2? (stablet), o (opasitet), cls}], labels: tekst per søyle.
  function barsHTML(card, gid, bars, labels, o = {}) {
    S(card).graphs[gid] = labels;
    const lines = (o.lines || []).map(([pct, t, c]) => `<span class="kb-gl" style="bottom:${pct}%;border-color:${c || 'var(--ki-text-lo, #696969)'}"><em style="color:${at(c) || 'var(--ki-text-mid, #979797)'}">${esc(t)}</em></span>`).join('');
    return `<div class="kb-bars${o.cls ? ' ' + o.cls : ''}" data-kgraph="${esc(gid)}" style="height:${o.h || 96}px;gap:${o.gap != null ? o.gap : 3}px">${lines}${bars.map((b) => `<span class="kb-bar${b.cls ? ' ' + b.cls : ''}" style="${b.ring ? 'box-shadow:inset 0 0 0 1.5px var(--ki-text, #fafafa);' : ''}"><i style="height:${Math.max(0, Math.min(100, b.h || 0)).toFixed(1)}%;background:${b.c};opacity:${b.o != null ? b.o : 1}"></i>${b.h2 ? `<i style="height:${Math.min(100, b.h2).toFixed(1)}%;background:${b.c2};opacity:${b.o2 != null ? b.o2 : 1}"></i>` : ''}${b.dot ? '<b class="kb-bdot"></b>' : ''}</span>`).join('')}<div class="kb-scrub" hidden><span class="kb-scrub-l"></span><span class="kb-scrub-t"></span></div></div>`
      + (o.axis ? `<div class="kb-axis">${o.axis.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : '');
  }

  /* ================================================================ strømpris («billigst kl.») */
  function billigstKl(K) {
    let serie = null;
    try {
      if (M.powerPrice) { const p = M.powerPrice(K.hass); if (p && (p.today || p.tomorrow)) serie = [...(p.today || Array(24).fill(null)).slice(0, 24), ...(p.tomorrow || [])]; }
      if (!serie && M.priceSensor && M.priceSeries) { const id = M.priceSensor(K.hass, {}); if (id) { K.st(id); serie = M.priceSeries(K.hass, id); } }
    } catch (e) { serie = null; }
    if (!serie) return null;
    const h0 = new Date().getHours();
    let best = null;
    for (let i = h0; i < Math.min(serie.length, h0 + 24); i++) { const v = serie[i]; if (v != null && isFinite(v) && (best == null || v < serie[best])) best = i; }
    return best == null ? null : `billigst kl. ${pad(best % 24)}`;
  }

  /* ================================================================ OVERSIKT */
  function siste12(K, card) {
    // _timeSoyler: de siste 12 hele klokketimene fra motorens egen timemåler + inneværende time
    const timer = K.a('sensor.ki_nettleie', 'timer_siste_12', []) || [];
    const grense = Number(K.a('sensor.ki_energi_status', 'grense_kwh', NaN));
    const naaKwh = Number(K.a('sensor.ki_energi_status', 'forbrukt_kwh', NaN));
    const est = K.n('sensor.ki_estimert_timesforbruk');
    const rader = timer.map((t) => ({ start: t.start, kwh: t.kwh, kv: t.kvalitet }));
    if (isFinite(naaKwh)) rader.push({ start: Math.floor(Date.now() / 3600000) * 3600, kwh: naaKwh, kv: 'forelopig', est });
    if (!rader.length) return note('Første time fullføres ved neste hele klokketime.');
    const maks = Math.max(0.5, ...rader.map((r) => r.kwh || 0), ...rader.map((r) => (isFinite(r.est) ? r.est : 0)), isFinite(grense) ? grense : 0) * 1.1;
    const h = (v) => 100 * v / maks;
    const bars = rader.map((r) => {
      const naa = r.kv === 'forelopig', over = isFinite(grense) && r.kwh != null && r.kwh > grense;
      const c = over ? R : naa ? P : r.kv === 'estimert' ? 'var(--ki-text-mid, #7f7f7f)' : 'var(--ki-text-2, #afafaf)';
      const b = { h: r.kwh == null ? 0 : h(r.kwh), c, o: r.kv === 'estimert' ? 0.55 : naa ? 1 : 0.75 };
      if (naa && isFinite(r.est) && r.est > r.kwh) { b.h2 = h(r.est - r.kwh); b.c2 = P; b.o2 = 0.3; }
      return b;
    });
    const hh = (r) => pad(new Date(r.start * 1000).getHours());
    const labels = rader.map((r) => `${hh(r)}:00 · ${r.kwh == null ? 'mangler måling' : nf(r.kwh, 2) + ' kWh (' + (r.kv === 'forelopig' ? 'nå' + (isFinite(r.est) ? ', forventet ' + nf(r.est, 2) : '') : r.kv || 'målt') + ')'}`);
    return barsHTML(card, 'siste12', bars, labels, { h: 96, lines: isFinite(grense) ? [[h(grense), `grense ${nf(grense, 2)}`, '#696969']] : [], axis: rader.map(hh) })
      + `<div class="kb-legend"><span><i style="background:var(--ki-text-2, #afafaf)"></i>Målt</span><span><i style="background:var(--ki-text-mid, #7f7f7f);opacity:.55"></i>Estimert</span><span><i style="background:${P}"></i>Nå (lys = forventet slutt)</span><span><i style="background:${R}"></i>Over grensen</span></div>`;
  }
  function forventet(K) {
    const prog = (n) => Number(K.a('sensor.ki_prognose', n, NaN));
    const vals = [['om_15_min_kw', 'om 15 min'], ['om_30_min_kw', 'om 30 min'], ['om_60_min_kw', 'om 1 t'], ['om_120_min_kw', 'om 2 t']].map(([k, t]) => [prog(k), t]);
    const tillatt = Number(K.a('sensor.ki_energi_status', 'tillatt_effekt_kw', NaN));
    const maks = Math.max(0.1, ...vals.map(([v]) => (isFinite(v) ? v : 0)), isFinite(tillatt) ? tillatt : 0);
    const progTekst = K.a('sensor.ki_prognose', 'forklaring', '');
    return `<div class="kb-fc">${vals.map(([v, t]) => `<div class="kb-stat"><span class="kb-fcb"><i style="height:${isFinite(v) ? (100 * v / maks).toFixed(0) : 0}%;background:${isFinite(tillatt) && v > tillatt ? R : P}"></i></span><b>${nf(v, 1)}</b><span>kW ${esc(t)}</span></div>`).join('')}</div>${note(progTekst)}`;
  }
  function leggetid(K, card) {
    const laster = K.laster().filter((l) => l.person && (l.person_type === 'barn' || l.person_type === 'ungdom'));
    if (!laster.length) return null;
    const sortert = [...laster].sort((x, y) => String(x.navn).localeCompare(String(y.navn)));
    return `<div class="kb-bed">${sortert.map((l) => `<button type="button" class="kb-bedb${l.leggetid ? ' on' : ''}" data-act="k-legg" data-key="${esc(l.key)}" data-avbryt="${l.leggetid ? 1 : 0}">
      <span class="kb-bedi">${M.icon(l.leggetid ? 'mdi:weather-sunny' : 'mdi:bed', 20)}</span><span class="kb-bedt"><b>${esc(l.navn)}</b><span>${l.leggetid ? 'Senket · trykk for å avbryte' : 'Trykk når hen legger seg'}</span></span></button>`).join('')}</div>`;
  }
  function styrer(K, card, kompakt) {
    // _overtakelse: hvem styrer ovnene + beredskapssjekk
    const skygge = K.pa('input_boolean.ki_skyggemodus');
    const motorPa = K.pa('input_boolean.ki_energi_hovedbryter');
    const styrerNaa = motorPa && !skygge;
    const klar = K.s('sensor.ki_overgang_klar', 'ukjent');
    const hindringer = K.a('sensor.ki_overgang_klar', 'hindringer', []) || [];
    const finnes = !!K.st('input_boolean.ki_skyggemodus');
    const klasse = klar === 'Klar' ? 'ok' : klar === 'Lærer fortsatt' ? 'advarsel' : 'feil';
    const maler = TIMESMALER_KANDIDATER.filter((id) => K.st(id));
    const tauSoner = K.a('sensor.ki_tidskonstanter', 'soner', {}) || {};
    const laerer = Object.values(tauSoner).filter((v) => (v.malinger || 0) < 20).length;
    const avslatt = soneListe(K).filter((l) => l.handling === 'utilgjengelig' || l.handling === 'av').length;
    return list([
      row({ dot: styrerNaa ? 'ok' : 'noytral', name: 'Motoren styrer ovnene', missing: !finnes, after: helpBtn(card, 'overtakelse'),
        sub: styrerNaa ? 'Skriver settpunkt til alle soner som står på «KI styrer».' : 'Regner og logger, men rører ingen ovner. Slå av skyggemodus for å la den styre.',
        tog: styrerNaa, act: finnes ? 'k-styrer' : null, data: { on: styrerNaa ? 1 : 0 }, ent: finnes ? 'switch.ki_skyggemodus' : null, haptic: 'selection' }) + helpBox(card, 'overtakelse'),
      (!kompakt || !styrerNaa) ? row({ dot: klasse, name: `Beredskap: ${klar}`, after: helpBtn(card, 'beredskap'), sub: hindringer.length ? hindringer.length + ' ting å være klar over' : 'Ingenting i veien', act: 'k-more', data: { id: 'sensor.ki_overgang_klar' }, ent: 'sensor.ki_overgang_klar' }) + helpBox(card, 'beredskap') : '',
      row({ dot: K.st('sensor.ki_energi_status') ? 'ok' : 'feil', name: 'Status fra motoren', sub: K.st('sensor.ki_energi_status') ? K.a('sensor.ki_energi_status', 'modus', K.s('sensor.ki_klima_status', '')) || 'Rapporterer' : 'sensor.ki_energi_status finnes ikke', v: SONE_TEKST[K.s('sensor.ki_energi_status', '')] || K.s('sensor.ki_energi_status') }),
      row({ dot: maler.length ? 'ok' : 'advarsel', name: 'Timesmåler', sub: maler.length ? maler.join(', ') : 'Ingen utility_meter funnet — motoren måler timen selv', v: maler.length ? nf(K.n(maler[0]), 2) + ' kWh' : 'egen måling' }),
      Object.keys(tauSoner).length ? row({ dot: laerer ? 'advarsel' : 'ok', name: 'Tidskonstanter', sub: laerer ? `${laerer} av ${Object.keys(tauSoner).length} soner har under 20 målinger` : 'Alle soner har nok målinger', v: laerer ? 'Lærer fortsatt' : 'Klar' }) : '',
      row({ dot: avslatt ? 'feil' : 'ok', name: 'Ovner', sub: avslatt ? `${avslatt} sone(r) avslått eller utilgjengelig` : 'Ingen ovner står avslått', v: avslatt ? String(avslatt) : 'OK' }),
    ]) + (hindringer.length && !kompakt ? `<ul class="kb-ul">${hindringer.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : '')
      + (!motorPa ? warn('Energimotoren er slått av under Oppsett. Ingenting styres.') : '');
  }
  function budsjett(K, card) {
    const a = (n, d) => K.a('sensor.ki_energi_status', n, d);
    const igjen = Number(a('igjen_kwh', NaN)), tillatt = Number(a('tillatt_effekt_kw', NaN)), fv = Number(a('forventet_effekt_kw', NaN));
    const uregulert = Number(a('uregulert_kw', NaN)), vvb = Number(a('vvb_reservert_kw', NaN)), ledig = Number(a('ledig_kw', NaN));
    const kilde = a('malekilde', '');
    const bredde = isFinite(fv) && isFinite(tillatt) && tillatt > 0 ? Math.max(0, Math.min(100, (fv / tillatt) * 100)) : 0;
    return stats([[nf(igjen, 2), 'kWh igjen'], [nf(tillatt, 2), 'kW tillatt'], [nf(fv, 2), 'kW forventet']])
      + `<div class="kb-track"><i style="width:${bredde.toFixed(0)}%;background:${bredde > 97 ? R : bredde > 88 ? OR : bredde > 75 ? Y : G}"></i></div>`
      + list([
        row({ name: 'Uregulert', after: helpBtn(card, 'uregulert'), sub: 'Alt motoren ikke styrer', v: nf(uregulert, 2) + ' kW' }) + helpBox(card, 'uregulert'),
        row({ name: 'Varmtvann reservert', v: nf(vvb, 2) + ' kW' }),
        row({ name: 'Ledig', v: isFinite(ledig) ? nf(ledig, 2) + ' kW' : '–' }),
        row({ name: 'Måling', after: helpBtn(card, 'malekilde'), sub: kilde || '–' }) + helpBox(card, 'malekilde'),
      ]) + (a('tak_aktivt', false) ? note('Regnestykket ga høyere tillatt effekt enn timegrensen fordi det er få minutter igjen av timen; verdien er kuttet ned til grensen.') : '');
  }
  function tiltak(K) {
    const senkede = K.laster().filter((l) => l.handling === 'senket');
    if (!senkede.length) return null;
    return list(senkede.map((l) => row({ dot: 'advarsel', name: l.navn, sub: l.forklaring || '', v: nf(l.settpunkt, 1) + '°', pill: true, ent: (l.entiteter || []).find((e) => e.startsWith('climate.')) })));
  }
  function vvbStatusRows(K, card, kort) {
    const a = (k, d) => K.a('sensor.ki_bereder', k, d);
    const konfigurert = !!a('bryter', '');
    const effekt = Number(a('effekt_w', NaN)), bryterPa = !!a('bryter_pa', false), varmer = !!a('varmer', false);
    const tvungen = K.pa('input_boolean.ki_vvb_tvungen_syklus_aktiv'), kritisk = K.pa('input_boolean.ki_vvb_kritisk_varslet');
    const vvbGrunn = K.s('sensor.ki_vvb_forklaring', a('forklaring', ''));
    const klasse = kritisk ? 'feil' : tvungen ? 'advarsel' : varmer ? 'ok' : 'noytral';
    const bryter = a('bryter', 'switch.varmtvannsbereder');
    const L = legio(K);
    return list([
      row({ dot: klasse, name: !konfigurert ? 'Ikke satt opp' : varmer ? 'Varmer nå' : bryterPa ? 'Bryter på, trekker ikke effekt' : 'Står stille', sub: vvbGrunn, v: isFinite(effekt) ? nf(effekt, 0) + ' W' : '–', act: 'k-more', data: { id: bryter }, ent: bryter }),
      kort ? row({ dot: L.klasse, name: `Legionella: ${L.tekst}`, sub: `Sist sikret ${dato(a('siste_syklus', null))} · frist ${dato(a('neste_frist', null))}`, act: 'k-tab', data: { tab: 'vann', seg: 'bereder' } }) : '',
    ]) + (kritisk ? warn('Berederen svarer ikke på tvungen start. Sjekk sikring, kontaktor og element fysisk.') : '');
  }
  function legio(K) {
    const a = (k, d) => K.a('sensor.ki_bereder', k, d);
    const legAktiv = a('legionella_aktiv', true), sikret = !!a('sikret', false), forfalt = !!a('forfalt', false);
    const klasse = !legAktiv ? 'noytral' : forfalt ? 'feil' : sikret ? 'ok' : 'advarsel';
    const tekst = !legAktiv ? 'Legionellasikring er av' : forfalt ? 'Forfalt — tvinges på' : sikret ? 'Sikret' : 'Bør kjøres snart';
    return { legAktiv, sikret, forfalt, klasse, tekst };
  }
  function borte(K, card) {
    // _borteInnstillinger + tilstedeværelse/hjemkomst fra heroen i JS-kortet
    const st = K.st('sensor.ki_tilstedevaerelse');
    const at = (st && st.attributes) || {};
    const tilstand = st ? st.state : null;
    const klasse = { hjemme: 'ok', hjemkomst: 'ok', kort_tur: 'gul', borte: 'gul', borte_lenge: 'info', ukjent: 'feil' }[tilstand] || 'noytral';
    const min = Number(at.minutter_borte);
    const varighet = !isFinite(min) ? null : min >= 1440 ? `${Math.floor(min / 1440)} døgn ${Math.floor((min % 1440) / 60)} t` : min >= 60 ? `${Math.floor(min / 60)} t ${min % 60} min` : `${min} min`;
    const erBorte = tilstand === 'borte' || tilstand === 'borte_lenge';
    let hjem = '';
    if (erBorte && at.hjemkomst_aktiv) {
      const naa = new Date();
      const tid = (v) => { const d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d : null; };
      const planSt = K.st('input_datetime.ki_hjemkomst_planlagt');
      let maal = tid(at.hjemkomst_planlagt) || (planSt && !['unknown', 'unavailable', ''].includes(planSt.state) ? tid(planSt.state) : null);
      if (!maal && at.hjemkomst_tid) { const [t, m] = String(at.hjemkomst_tid).split(':').map(Number); maal = new Date(naa); maal.setHours(t || 0, m || 0, 0, 0); }
      if (maal) {
        const igjen = Math.round((maal - naa) / 60000);
        const totalt = isFinite(min) ? min + Math.max(0, igjen) : Math.max(0, igjen);
        const pct = igjen <= 0 ? 100 : (totalt > 0 ? Math.max(0, Math.min(100, (min / totalt) * 100)) : 0);
        const lesbar = igjen >= 60 ? `${Math.floor(igjen / 60)} t ${igjen % 60} min` : `${igjen} min`;
        const iDag = maal.toDateString() === naa.toDateString();
        const dag = iDag ? '' : maal.toLocaleDateString('nb-NO', { weekday: 'short' }) + ' ';
        hjem = row({ dot: 'ok', name: `${K.l('Hjemkomst')} ${dag}${klokke(maal)}`, sub: igjen > 0 ? `om ${lesbar}` : 'når som helst', v: '' })
          + `<div class="kb-track sm"><i style="width:${pct.toFixed(0)}%;background:${B}"></i></div>`;
      }
    }
    const tall = [['input_number.ki_helg_auto_timer', 'Timer før auto', 0, 't'], ['input_number.ki_temp_helg', 'Borte panelovn', 1, '°C'],
      ['input_number.ki_temp_helg_gulvvarme', 'Borte gulv', 1, '°C'], ['input_number.ki_temp_helg_bad', 'Borte bad', 1, '°C']];
    return list([
      st ? row({ dot: klasse, name: at.tekst || tilstand, sub: varighet && erBorte ? `Borte i ${varighet}` : tilstand === 'kort_tur' ? 'Kort tur — huset senkes ikke' : '', act: 'k-more', data: { id: 'sensor.ki_tilstedevaerelse' }, ent: 'sensor.ki_tilstedevaerelse' }) : row({ dot: 'noytral', name: 'Tilstedeværelse', sub: 'sensor.ki_tilstedevaerelse finnes ikke (KI Energi 2.20.0)', v: '–' }),
      hjem,
      row({ dot: at.venter_svar || K.pa('input_boolean.ki_helg_venter_svar') ? 'advarsel' : 'noytral', name: 'Venter på svar', after: helpBtn(card, 'venter_svar'), v: at.venter_svar || K.pa('input_boolean.ki_helg_venter_svar') ? 'Ja' : 'Nei', act: 'k-more', data: { id: 'input_boolean.ki_helg_venter_svar' } }) + helpBox(card, 'venter_svar'),
      tog(K, card, 'input_boolean.ki_helg_auto', K.l('Slå på automatisk'), K.l('Helg automatisk ved fravær')),
      ...tall.map(([id, n, d, u]) => step(K, card, id, n, d, u)),
    ]);
  }

  /* ================================================================ SONER */
  const soneIkon = (l) => (/gulv/i.test(l.type || '') ? 'mdi:heating-coil' : /panel/i.test(l.type || '') ? 'mdi:radiator' : /pumpe/i.test(l.type || '') ? 'mdi:heat-pump' : /bad/i.test(l.navn || '') ? 'mdi:shower' : 'mdi:thermostat');
  function soneListe(K) { return K.laster().filter((l) => l.type !== 'bryter'); }
  function soneGrid(K, card) {
    const laster = soneListe(K);
    if (!laster.length) return note('Motoren har ikke rapportert soner ennå.');
    const kb = S(card);
    return `<div class="kb-zgrid">${laster.map((l) => {
      const h = HANDLING[l.venter ? 'venter' : l.handling] || { tekst: l.handling || '–', k: 'noytral' };
      const c = TONE[h.k];
      const valgt = kb.zone === l.key;
      return `<button type="button" class="kb-zt${valgt ? ' on' : ''}" data-act="k-zone" data-key="${esc(l.key)}">
        <span class="kb-zt-top"><span class="kb-zt-i" style="color:${at(c)};background:${al(c, 0.18)}">${M.icon(soneIkon(l), 18)}</span>${chipHTML(l.overstyrt ? 'Manuell' : h.tekst, l.overstyrt ? 'noytral' : h.k)}</span>
        <span class="kb-zt-temp">${l.naa !== null && l.naa !== undefined ? nf(l.naa, 1) + '°' : '–'}</span>
        <span class="kb-zt-n">${esc(l.navn)}</span><span class="kb-zt-s">mål ${esc(l.settpunkt ?? l.mal ?? '–')}° · ${esc(l.forklaring || '')}</span></button>`;
    }).join('')}</div>`;
  }
  function soneDetalj(K, card) {
    const kb = S(card);
    const l = soneListe(K).find((x) => x.key === kb.zone);
    if (!l) return '';
    const h = HANDLING[l.venter ? 'venter' : l.handling] || { tekst: l.handling || '–', k: 'noytral' };
    const c = TONE[h.k];
    const styr = l.styr || null;
    const felt = (l.helpere && l.helpere.length) ? l.helpere : [];
    const ov = kb.ov[l.key] !== undefined ? kb.ov[l.key] : Number(l.overstyrt_temp ?? l.mal ?? l.settpunkt ?? 21);
    // _soneDetaljer: live effekt/temperatur
    const ents = l.entiteter || [];
    const eff = ents.filter((e) => e.startsWith('sensor.') && /power|effekt|_w$/i.test(e));
    const clim = ents.filter((e) => e.startsWith('climate.'));
    const tempEnt = ents.find((e) => e.startsWith('sensor.') && /temp/i.test(e)) || null;
    const effW = eff.reduce((s, e) => { const v = K.n(e); return isFinite(v) ? s + v : s; }, 0);
    const temp = tempEnt ? K.n(tempEnt) : (clim.length ? Number(K.a(clim[0], 'current_temperature', NaN)) : NaN);
    const sett = clim.length ? Number(K.a(clim[0], 'temperature', NaN)) : NaN;
    const hva = kb.zgraf[l.key] || 'temp';
    const til = l.overstyrt && l.overstyrt_til ? klokke(l.overstyrt_til) : null;
    return `<section class="kb kb-zone" data-key="kb-zone">
      <div class="kb-zh"><span class="kb-zt-i lg" style="color:${at(c)};background:${al(c, 0.18)}">${M.icon(soneIkon(l), 22)}</span>
        <span class="kb-zh-t"><b>${esc(l.navn)}</b><span>${esc(l.forklaring || '')}</span></span>
        <button type="button" class="kb-x" data-act="k-zone" data-key="" aria-label="Lukk">${M.icon('mdi:close', 18)}</button></div>
      ${facts([fact(h.tekst, h.k), l.overstyrt ? fact(til ? `Manuelt til ${til}` : 'Manuell', 'noytral') : '', fact(`Prioritet ${l.prio ?? '–'}`), fact(String(l.type || '–')), fact(`plan ${nf(l.effekt, 2)} kW`), l.leggetid ? fact('leggetid', 'noytral') : '', l.forvarm ? fact('forvarmer', 'ok') : ''])}
      ${stats([[eff.length ? nf(effW, 0) : '–', `W nå${eff.length > 1 ? ' (' + eff.length + ' ovner)' : ''}`], [isFinite(temp) ? nf(temp, 1) + '°' : '–', 'rom'], [isFinite(sett) ? nf(sett, 1) + '°' : '–', `settpunkt${clim.length > 1 ? ' (' + clim.length + ')' : ''}`, clim[0] ? { ent: clim[0] } : null]])}
      ${l.skriving ? note(`${M.icon('mdi:pencil-outline', 14, 'vertical-align:-3px')} ${esc(l.skriving)}`, true) : ''}
      <div class="kb-ovbox">
        <button type="button" class="kb-ovb" data-act="k-ov" data-key="${esc(l.key)}" data-dir="-1" data-haptic="selection" aria-label="Senk">${M.icon('mdi:minus', 22)}</button>
        <span class="kb-ovv"><b>${nf(ov, 1)}°</b><span>${l.overstyrt ? 'overstyrt nå' : 'overstyr midlertidig'}</span></span>
        <button type="button" class="kb-ovb" data-act="k-ov" data-key="${esc(l.key)}" data-dir="1" data-haptic="selection" aria-label="Øk">${M.icon('mdi:plus', 22)}</button>
      </div>
      <div class="kb-durs">${[[60, '1 t'], [120, '2 t'], [360, '6 t']].map(([m, t]) => `<button type="button" class="kb-dur" data-act="k-ovset" data-key="${esc(l.key)}" data-min="${m}" data-haptic="off">${t}</button>`).join('')}</div>
      ${l.overstyrt ? `<button type="button" class="kb-btn wide" data-act="k-ovdel" data-key="${esc(l.key)}" data-haptic="off">${M.icon('mdi:close-circle-outline', 18)}<span>Fjern overstyring</span></button>` : ''}
      ${list([styr ? tog(K, card, styr, 'KI styrer sonen', 'Av = motoren rører den ikke') : '',
        ...felt.map(([n, navn]) => step(K, card, String(n).includes('.') ? n : `input_number.${n}`, navn, 1, '°C'))])}
      ${sub('Siste 6 timer')}
      ${seg([['temp', 'Temperatur', 'mdi:thermometer'], ['effekt', 'Effekt', 'mdi:flash']], hva, 'k-zgraf', ` data-key="${esc(l.key)}"`)}
      ${soneGraf(K, card, l, hva, { eff, tempEnt, clim })}
    </section>`;
  }
  function soneGraf(K, card, l, hva, { eff, tempEnt, clim }) {
    const N = 24, H = 6;
    if (hva === 'temp' && !tempEnt) return note(clim.length ? 'Temperaturen ligger som attributt på termostaten og lagres ikke som egen serie — legg til en temperatursensor i sonen for graf.' : 'Ingen temperaturhistorikk ennå.');
    if (hva === 'effekt' && !eff.length) return note('Ingen effektsensor i sonen.');
    const ids = hva === 'temp' ? [tempEnt] : eff;
    const d = hist(card, K, ids, H);
    if (!d) return `<div class="kb-wait">Henter historikk …</div>`;
    let vals;
    if (hva === 'temp') vals = buckets(d[mapId(tempEnt)] || [], N, H);
    else { const per = eff.map((e) => buckets(d[mapId(e)] || [], N, H)); vals = Array.from({ length: N }, (_, i) => per.reduce((s, p) => (p[i] == null ? s : (s == null ? 0 : s) + p[i]), null)); }
    const ok = vals.filter((v) => v != null);
    if (!ok.length) return note(hva === 'effekt' ? 'Ingen effekthistorikk ennå.' : 'Ingen temperaturhistorikk ennå.');
    const mn = Math.min(...ok), mx = Math.max(...ok);
    const lo = hva === 'temp' ? mn - Math.max(0.5, (mx - mn) * 0.3) : 0, span = Math.max(hva === 'temp' ? 0.5 : 1, mx - lo);
    const unit = hva === 'temp' ? '°' : ' W', dec = hva === 'temp' ? 1 : 0;
    const bars = vals.map((v, i) => ({ h: v == null ? 0 : 8 + 92 * (v - lo) / span, c: G, o: i === N - 1 ? 1 : 0.4 }));
    const labels = vals.map((v, i) => `${bucketLabel(i, N, H)} · ${v == null ? '–' : nf(v, dec) + unit}`);
    return `<div class="kb-zg">${barsHTML(card, 'sone:' + l.key + ':' + hva, bars, labels, { h: 84, gap: 2 })}<div class="kb-zmm"><span><b>${nf(mx, dec)}${unit}</b>maks</span><span><b>${nf(mn, dec)}${unit}</b>min</span></div></div>`
      + `<div class="kb-axis"><span>−6 t</span><span>−3 t</span><span>nå</span></div>`;
  }

  /* ================================================================ ENERGI */
  const N_ = (K) => (k, d) => K.a('sensor.ki_nettleie', k, d);
  const kr = (v) => (v == null ? 'ukjent' : nf(v, 0) + ' kr');
  function dynamisk(K, card) {
    const N = N_(K);
    const grunn = K.a('sensor.ki_energi_status', 'grense_grunn', '');
    const grense = Number(K.a('sensor.ki_energi_status', 'grense_kwh', NaN));
    const kv = N('datakvalitet', '');
    const kvK = kv === 'god' ? 'ok' : kv === 'delvis' ? 'advarsel' : 'feil';
    return big(nf(grense, 2), 'kWh denne timen') + concl(N('hvorfor', grunn))
      + stats([[N('dagens_maks_kwh', null) != null ? nf(N('dagens_maks_kwh'), 2) : '–', `døgnmaks i dag${N('dagens_maks_time', null) ? ' kl. ' + N('dagens_maks_time') : ''}`],
        [N('registrert_snitt', null) != null ? nf(N('registrert_snitt'), 2) : '–', 'snitt topp 3 (registrert)'],
        [N('forventet_time_kwh', null) != null ? nf(N('forventet_time_kwh'), 2) : '–', 'forventet denne timen']])
      + facts([fact(`data ${kv || '–'}`, kvK), fact(`reserve ${nf(N('reserve_kwh', 0), 2)} kWh`), fact(`${N('dager_igjen', '–')} dager igjen`),
        N('mal_tapt', false) ? fact('mål passert', 'advarsel') : '', N('tariff_ukjent', false) ? fact('tariff ukjent', 'feil') : '', N('tillat_dyrere_trinn', false) ? fact('dyrere trinn tillatt', 'advarsel') : '']);
  }
  function dognGraf(K, card) {
    // _dognGraf: døgnmaks per dato denne måneden, topp tre uthevet, mål og grense som linjer
    const N = N_(K);
    const dager = N('dogn_maned', []) || [];
    const eksterne = (N('topp_tre', []) || []).filter((t) => t.kilde === 'ekstern');
    const iDag = new Date();
    const antall = new Date(iDag.getFullYear(), iDag.getMonth() + 1, 0).getDate();
    const perDag = {};
    dager.forEach((d) => { perDag[Number(String(d.dato).slice(8, 10))] = d; });
    const mal = Number(N('mal_kw', NaN)), hard = Number(N('hard_kwh', NaN)), grense = Number(N('grense_kwh', NaN));
    const verdier = dager.map((d) => d.kwh).concat(eksterne.map((t) => t.kwh)).filter(isFinite);
    if (!dager.length && !eksterne.length) return note('Grafen fylles etter hvert som dager fullføres.');
    const maks = Math.max(1, ...verdier, isFinite(hard) ? hard : 0, isFinite(mal) ? mal : 0) * 1.08;
    const hoyde = (v) => 100 * v / maks;
    const bars = [], labels = [], axis = [];
    eksterne.forEach((t) => { bars.push({ h: hoyde(t.kwh), c: B, o: 0.6 }); labels.push(`ekstern, ukjent dato · ${nf(t.kwh, 2)} kWh`); axis.push('?'); });
    for (let dag = 1; dag <= antall; dag++) {
      const d = perDag[dag];
      bars.push({ h: d ? hoyde(d.kwh) : 0, c: !d ? 'var(--ki-text-lo, #545454)' : d.topp ? P : d.kvalitet === 'estimert' ? 'var(--ki-text-mid, #7f7f7f)' : 'var(--ki-text-2, #afafaf)', o: d && d.kvalitet === 'estimert' && !d.topp ? 0.55 : 1, ring: dag === iDag.getDate(), dot: !!(d && d.manglende_timer) });
      labels.push(`${dag}. · ${d ? nf(d.kwh, 2) + ' kWh kl. ' + d.time + ' (' + d.kvalitet + (d.manglende_timer ? ', ' + d.manglende_timer + ' t mangler' : '') + ')' : 'ingen data'}`);
      axis.push(dag % 5 === 0 || dag === 1 ? String(dag) : '');
    }
    const lines = [];
    if (isFinite(mal)) lines.push([hoyde(mal), `mål ${nf(mal, 1)}`, P]);
    if (isFinite(grense)) lines.push([hoyde(grense), `grense ${nf(grense, 2)}`, 'var(--ki-text-mid, #979797)']);
    return barsHTML(card, 'dogn', bars, labels, { h: 100, gap: 2, lines, axis, cls: 'dense' })
      + `<div class="kb-legend"><span><i style="background:${P}"></i>Topp tre</span><span><i style="background:var(--ki-text-2, #afafaf)"></i>Andre dager</span><span><i style="background:var(--ki-text-mid, #7f7f7f);opacity:.55"></i>Estimert</span><span><i style="background:${B};opacity:.6"></i>Ekstern (uten dato)</span><span>Ramme = i dag · prikk = timer mangler</span></div>`;
  }
  function topp3(K, card) {
    const N = N_(K);
    const datoKort = (d) => (d ? String(d).slice(8, 10) + '.' + String(d).slice(5, 7) + '.' : 'ukjent dato');
    const toppRad = (t) => row({ dot: t.prognose ? 'advarsel' : t.kilde === 'ekstern' ? 'noytral' : 'ok', name: datoKort(t.dato),
      nameHtml: esc(datoKort(t.dato)) + (t.prognose ? chipHTML('prognose', 'advarsel') : '') + (t.kilde === 'ekstern' ? chipHTML('ekstern', 'noytral') : ''),
      sub: `${t.time ? 'kl. ' + t.time + ':00 · ' : ''}${t.kvalitet || ''}`, v: nf(t.kwh, 2) + ' kWh' });
    const reg = (N('topp_tre', []) || []);
    const fv = N('forventet_topp_tre', null);
    const ok = N('okning_fastledd_kr', null);
    return dognGraf(K, card) + sub('Registrert') + (reg.length ? list(reg.map(toppRad)) : note('Ingen fullførte dager ennå.'))
      + (fv ? sub(`Hvis denne timen ender på ${nf(N('forventet_time_kwh'), 2)} kWh — prognose`) + list((fv || []).map(toppRad))
        + list([row({ name: `Snitt ${nf(N('forventet_snitt', NaN), 2)} → ${kr(N('forventet_trinn_kr', null))}/mnd`, v: ok == null ? 'økning ukjent' : ok > 0 ? '+' + nf(ok, 0) + ' kr fastledd' : N('redusert_margin', false) ? 'samme trinn, mindre rom' : N('hoyere_dognmaks', false) ? 'ny døgnmaks, uendret topp 3' : 'ingen endring' })]) : '');
  }
  function effekt6(K, card) {
    const U = 'sensor.ki_uregulert_effekt', ST = 'sensor.ki_styrt_effekt';
    const live = `Nå ${nf(K.n(U) / 1000, 2)} + ${nf(K.n(ST) / 1000, 2)} kW`;
    const legend = `<div class="kb-legend"><span><i style="background:var(--ki-text-2, #afafaf)"></i>Uregulert</span><span><i style="background:${OR}"></i>Styrt varme</span><span class="kb-live"><i></i>${esc(live)}</span></div>`;
    if (!K.st(U) && !K.st(ST)) return note('Ingen historikk ennå — sensorene er nye') + legend;
    const d = hist(card, K, [U, ST], 6);
    if (!d) return `<div class="kb-wait">Henter historikk …</div>` + legend;
    const NB = 18;
    const a = buckets(d[U] || [], NB, 6).map((v) => (v == null ? null : v / 1000)), b = buckets(d[ST] || [], NB, 6).map((v) => (v == null ? null : v / 1000));
    if (!a.some((v) => v != null) && !b.some((v) => v != null)) return note('Ingen historikk ennå — sensorene er nye') + legend;
    const maks = Math.max(0.2, ...a.map((v, i) => (v || 0) + (b[i] || 0))) * 1.1;
    const bars = a.map((v, i) => ({ h: 100 * (v || 0) / maks, c: 'var(--ki-text-2, #afafaf)', o: 0.7, h2: 100 * (b[i] || 0) / maks, c2: OR }));
    const labels = a.map((v, i) => `${bucketLabel(i, NB, 6)} · Uregulert ${nf(v, 2)} · Styrt ${nf(b[i], 2)} kW`);
    return barsHTML(card, 'effekt6', bars, labels, { h: 90, cls: 'stack', axis: ['−6 t', '−4 t', '−2 t', 'nå'] }) + legend;
  }
  function grenser(K, card) {
    return list([
      step(K, card, 'input_number.ki_maks_time_kwh', 'Absolutt timegrense', 2, 'kWh'),
      step(K, card, 'input_number.ki_mal_trinn_kw', 'Ønsket trinn: snitt under', 1, 'kW'),
      step(K, card, 'input_number.ki_reserve_topp_kwh', 'Reserve mot neste trinn', 2, 'kWh'),
      tog(K, card, 'input_boolean.ki_tillat_dyrere_trinn', 'Tillat dyrere trinn', 'På = komfort foran fastledd; bare den absolutte grensen gjelder'),
      step(K, card, 'input_number.ki_min_time_kwh', 'Laveste timegrense', 1, 'kWh'),
      step(K, card, 'input_number.ki_reserve_uregulert_kwh', 'Reserve uregulert', 2, 'kWh'),
      step(K, card, 'input_number.ki_shed_gulv_maks', 'Maks senking gulvvarme', 1, '°C', { help: 'shed' }),
      step(K, card, 'input_number.ki_shed_panel_maks', 'Maks senking panelovn', 1, '°C'),
      step(K, card, 'input_number.ki_komfort_vekt', 'Komfortvekt', 0, '', { help: 'komfortvekt' }),
    ]);
  }
  const SPAR_IKON = { motor: 'mdi:engine', gardiner: 'mdi:curtains', hanklevarmer: 'mdi:radiator', bereder: 'mdi:water-boiler', lys: 'mdi:lightbulb-group-outline' };
  const SPAR_NAVN = { motor: 'Varmestyring', gardiner: 'Gardiner', hanklevarmer: 'Håndklevarmer', bereder: 'Bereder', lys: 'Lys' };
  function sparer(K) {
    const st = K.st('sensor.ki_sparing');
    if (!st) return null;
    const a = st.attributes || {};
    const poster = a.poster || {};
    const maks = Math.max(1, ...Object.values(poster).map((p) => Math.max(p.kr || 0, p.potensial_kr || 0)));
    const lysSt = K.st('sensor.ki_lys');
    const vis = Object.entries(poster).filter(([k]) => k !== 'gardiner' || K.har('gardiner')).filter(([k]) => k !== 'hanklevarmer' || K.har('hanklevarmer'))
      .filter(([k]) => k !== 'lys' || (lysSt && (lysSt.attributes.regler || []).length));
    return big(nf(Number(a.total_kr_maned || 0), 0), `kr spart i ${new Date().toLocaleDateString('nb-NO', { month: 'long' })}`)
      + `<div class="kb-spar">${vis.map(([k, p]) => `<div class="kb-sp"><div class="kb-sp-h"><span>${M.icon(SPAR_IKON[k] || 'mdi:cash', 17, 'color:var(--ki-text-mid, #979797)')}${esc(SPAR_NAVN[k] || k)}</span><b>${nf(p.kr || 0, 0)} kr <small>${nf(p.kwh || 0, 1)} kWh</small></b></div>
        <div class="kb-sp-bar"><i style="width:${(100 * (p.kr || 0) / maks).toFixed(0)}%"></i>${p.potensial_kr ? `<em style="width:${(100 * p.potensial_kr / maks).toFixed(0)}%" title="kunne spart"></em>` : ''}</div>
        ${p.tekst || p.potensial_kr > 0.5 ? `<div class="kb-rs">${esc(p.tekst || '')}${p.potensial_kr > 0.5 ? ` · +${nf(p.potensial_kr, 0)} kr mulig` : ''}</div>` : ''}</div>`).join('')}</div>`
      + (Number(a.gardin_kunne_spart_kr || 0) > 0.5 ? note(`Gardinene sto åpne om natten i timer de burde vært lukket — ${nf(Number(a.gardin_kunne_spart_kr), 0)} kr til denne måneden hvis de lukkes.`) : '');
  }
  function maaned(K) {
    return stats([[nf(K.n('input_number.ki_stat_unngatte_topper'), 0), 'unngåtte topper'], [nf(K.n('input_number.ki_stat_shed_hendelser'), 0), 'utkoblinger'], [nf(K.n('input_number.ki_stat_flyttet_kwh'), 2), 'kWh flyttet'],
      [nf(K.n('sensor.ki_besparelse'), 0), 'kr spart (est.)'], [nf(K.a('sensor.ki_besparelse', 'spart_nettleie_kr', NaN), 0), 'kr nettleie'], [nf(K.n('input_number.ki_stat_komfortavvik'), 1), '°C·t komfortavvik']], 3)
      + list([row({ name: 'Neste trinn koster mer', sub: 'fra tarifftabellen', v: `${nf(K.a('sensor.ki_besparelse', 'trinn_diff_kr', NaN), 0)} kr/mnd` })])
      + note(K.a('sensor.ki_besparelse', 'merknad', 'Uten kontrollgruppe er «uten KI-styring» alltid et estimat.'));
  }

  /* ================================================================ VANN OG BAD */
  function vvbHoved(K, card) {
    const a = (k, d) => K.a('sensor.ki_bereder', k, d);
    const L = legio(K);
    const dager = K.n('sensor.ki_vvb_dager_siden_siste_syklus');
    const intervall = Number(a('intervall_dager', 3)), hard = Number(a('hard_frist_dager', 7));
    const pct = isFinite(dager) && hard > 0 ? Math.max(0, Math.min(100, (dager / hard) * 100)) : 0;
    const c = TONE[L.klasse];
    const varmer = !!a('varmer', false), konfigurert = !!a('bryter', '');
    const ring = `<div class="kb-legring" style="background:conic-gradient(${c} ${(100 - pct).toFixed(0)}%, var(--ki-surface-3, #2f2f2f) 0)"><div>${M.icon(L.forfalt ? 'mdi:shield-alert' : L.sikret ? 'mdi:shield-check' : 'mdi:shield-outline', 22, `color:${c}`)}<span>${nf(dager, 1)} / ${nf(intervall, 0)} d</span></div></div>`;
    return `<div class="kb-lg">${ring}<div class="kb-lg-t"><span class="kb-cap" style="color:${at(c)}">Legionella ${esc(L.tekst.toLowerCase())}</span><b>${esc(!konfigurert ? 'Ikke satt opp' : varmer ? 'Varmer nå' : a('bryter_pa', false) ? 'Bryter på, trekker ikke effekt' : 'Står stille')}</b><span>${esc(K.s('sensor.ki_vvb_forklaring', a('forklaring', '')))}${a('neste_frist', null) ? ` Frist ${esc(dato(a('neste_frist', null)))}.` : ''}</span></div></div>`
      + vvbStatusRows(K, card, false);
  }
  function vvbBrytere(K, card) {
    const a = (k, d) => K.a('sensor.ki_bereder', k, d);
    const konfigurert = !!a('bryter', '');
    const bryter = a('bryter', 'switch.varmtvannsbereder');
    const bryterPa = !!a('bryter_pa', false);
    return list([
      row({ name: 'Bryteren nå', sub: `${bryterPa ? 'På' : 'Av'} · vindu ${a('vindu', '') || '–'}`, tog: bryterPa, missing: !konfigurert, act: konfigurert ? 'k-tog' : null, data: { id: bryter, kind: 'bryter' }, ent: konfigurert ? bryter : null, haptic: 'selection' }),
      tog(K, card, 'input_boolean.ki_vvb_legionella_aktiv', 'Legionellasikring', 'Av = ingen tvungen syklus, bare vindu og pris'),
    ]);
  }
  function vvbHandling(K, card) {
    if (!K.har('vvb_bryter')) return null;
    const boost = K.pa('binary_sensor.ki_vvb_boost_aktiv');
    return btns(card, [
      { label: boost ? 'Avbryt boost' : 'Boost nå', icon: 'mdi:rocket-launch', dom: 'script', svc: boost ? 'ki_vvb_avbryt_boost' : 'ki_vvb_boost', ok: boost ? 'Boost avbrutt' : 'Boost startet', on: boost },
      { label: 'Tving syklus nå', icon: 'mdi:bacteria-outline', dom: 'script', svc: 'ki_vvb_tving_syklus_na', ok: 'Syklus startet' },
    ]);
  }
  function prisStripe(K, card) {
    const d = K.a('sensor.ki_vvb_billige_timer', 'doegn', []) || [];
    if (!d.length) return note('Ingen døgndata ennå.');
    const priser = d.map((x) => x.pris).filter((p) => p != null && isFinite(p));
    const maks = priser.length ? Math.max(...priser) : 0, min = priser.length ? Math.min(...priser) : 0, span = Math.max(maks - min, 0.01);
    const bars = d.map((x) => ({ h: priser.length && x.pris != null ? 25 + 75 * ((x.pris - min) / span) : 55, c: x.valgt ? G : x.vindu ? B : '#696969', o: x.valgt ? 1 : x.vindu ? 0.55 : 0.6, ring: !!x.naa }));
    const labels = d.map((x) => `${pad(x.t)}:00${x.pris != null ? ' · ' + nf(x.pris, 2) : ''}${x.valgt ? ' · berederen kjører' : x.vindu ? ' · vindu' : ''}`);
    return barsHTML(card, 'pris', bars, labels, { h: 70, gap: 2, axis: d.map((x) => (x.t % 6 === 0 ? pad(x.t) : '')) })
      + `<div class="kb-legend"><span><i style="background:${G}"></i>Berederen kjører</span><span><i style="background:${B};opacity:.55"></i>Vindu</span><span>${priser.length ? `Pris ${nf(min, 2)}–${nf(maks, 2)}` : 'Ingen prisdata'}</span></div>`;
  }
  function vvbPris(K, card) {
    if (!K.har('vvb_bryter')) return null;
    const metode = K.a('sensor.ki_vvb_billige_timer', 'metode', '');
    const norgespris = !!K.a('sensor.ki_vvb_billige_timer', 'norgespris', false);
    const alltid = K.pa('input_boolean.ki_vvb_alltid_pa'), folg = K.pa('input_boolean.ki_vvb_folg_spotpris');
    const modus = alltid ? 'alltid' : (norgespris || !folg) ? 'vindu' : 'spot';
    return concl(K.s('sensor.ki_vvb_forklaring', '–')) + prisStripe(K, card)
      + note(`${metode}${K.a('sensor.ki_vvb_billige_timer', 'antall_kandidater', 0) > 24 ? ' Prisdata kommer i kvartersoppløsning, så flere oppføringer per time slås sammen.' : ''}`)
      + seg([['spot', 'Følg spotpris', 'mdi:chart-line', norgespris], ['vindu', norgespris ? 'Norgespris' : 'Nettleievindu', 'mdi:clock-outline'], ['alltid', 'Alltid på', 'mdi:power']], modus, 'k-vvbmodus')
      + list([
        tog(K, card, 'input_boolean.ki_vvb_prisstyring', 'Prisstyring', 'Av = berederen står som den står'),
        norgespris ? row({ dot: 'ok', name: 'Norgespris aktiv', sub: 'Strømprisen er lik hele døgnet. Berederen legges i vinduet med billigste nettleie (natt/helg) — spotpris trengs ikke.' })
          : tog(K, card, 'input_boolean.ki_vvb_folg_spotpris', 'Følg spotpris', K.a('sensor.ki_vvb_billige_timer', 'har_priser', false) ? 'Velger de billigste enkelttimene fram til fristen' : 'Ingen prisdata — velg spotprissensor under Konfigurer, ellers brukes vinduet'),
        tog(K, card, 'input_boolean.ki_vvb_alltid_pa', 'Alltid på', 'Overstyrer automatikken helt'),
      ]);
  }
  function vvbVindu(K, card) {
    if (!K.har('vvb_bryter')) return null;
    const iv = K.pa('binary_sensor.ki_vvb_i_vindu');
    return list([row({ dot: iv ? 'ok' : 'noytral', name: 'Oppvarmingsvindu', sub: K.pa('binary_sensor.ki_vvb_ferdig_i_vinduet') ? 'Ferdig for i natt' : iv ? 'Åpent nå' : 'Lukket', act: 'k-more', data: { id: 'binary_sensor.ki_vvb_i_vindu' }, ent: 'binary_sensor.ki_vvb_i_vindu' })])
      + dognplan(K, [{ navn: 'Bereder', spenn: [['input_datetime.ki_vvb_vindu_start', 'input_datetime.ki_vvb_klar_innen', 'ok', 'Vindu']] }])
      + list([
        step(K, card, 'input_number.vvb_billigste_timer_dogn', 'Antall billige timer', 0, 't'),
        step(K, card, 'input_datetime.ki_vvb_vindu_start', 'Vindu starter'),
        step(K, card, 'input_datetime.ki_vvb_klar_innen', 'Ferdig innen'),
      ]);
  }
  function vvbLegionella(K, card) {
    const a = (k, d) => K.a('sensor.ki_bereder', k, d);
    const L = legio(K);
    const dager = K.n('sensor.ki_vvb_dager_siden_siste_syklus');
    const hard = Number(a('hard_frist_dager', 7)), intervall = Number(a('intervall_dager', 3));
    const pct = isFinite(dager) && hard > 0 ? Math.max(0, Math.min(100, (dager / hard) * 100)) : 0;
    const mettet = K.pa('binary_sensor.ki_vvb_mettet'), ingen = K.pa('binary_sensor.ki_vvb_ingen_respons');
    return `<div class="kb-track"><i style="width:${pct.toFixed(0)}%;background:${TONE[L.klasse]}"></i><b style="left:${hard > 0 ? Math.min(100, (intervall / hard) * 100).toFixed(0) : 0}%"></b></div>
      <div class="kb-tracktxt"><span>${isFinite(dager) ? nf(dager, 1) + ' d siden' : '–'}</span><span>ønsket hver ${nf(intervall, 0)} d</span><span>frist ${nf(hard, 0)} d</span></div>`
      + list([
        row({ dot: L.sikret ? 'ok' : 'noytral', name: 'Sist sikret (metning)', sub: 'Termostaten koblet ut etter full oppvarming', v: dato(a('siste_syklus', null)), act: 'k-more', data: { id: 'datetime.ki_vvb_siste_godkjente_syklus' }, ent: 'datetime.ki_vvb_siste_godkjente_syklus' }),
        row({ dot: L.forfalt ? 'feil' : 'noytral', name: 'Neste frist', sub: 'Etter dette tvinges berederen på uansett pris', v: dato(a('neste_frist', null)) }),
      ])
      + stats([[nf(Number(a('reservert_kw', NaN)), 2), 'kW reservert'], [nf(K.n('sensor.ki_vvb_oppvarming_minutter'), 0), 'min varmet'], [mettet ? 'Ja' : 'Nei', 'mettet nå']])
      + list([
        row({ dot: mettet ? 'ok' : ingen ? 'feil' : 'noytral', name: 'Metning', act: 'k-more', data: { id: 'binary_sensor.ki_vvb_mettet' }, ent: 'binary_sensor.ki_vvb_mettet',
          sub: mettet ? 'Termostaten har koblet ut — vannet er på settpunkt' : ingen ? 'Bryteren står på uten at effekten stiger — sannsynlig feil' : K.pa('input_boolean.ki_vvb_har_trukket_effekt') ? 'Har trukket effekt denne runden, venter på utkobling' : 'Ingen effekt registrert denne runden' }),
        step(K, card, 'input_number.ki_vvb_intervall_dager', 'Ønsket legionellaintervall', 0, 'd'),
        step(K, card, 'input_number.ki_vvb_maks_dager', 'Hard frist', 0, 'd'),
        tog(K, card, 'input_boolean.ki_vvb_legionella_aktiv', 'Legionellasikring', 'Kan ikke blokkeres av sparing når den er på'),
      ])
      + (K.har('vvb_bryter') ? btns(card, [
        { label: 'Kjør syklus nå', icon: 'mdi:bacteria-outline', dom: 'ki_energi', svc: 'vvb_tving_syklus', ok: 'Syklus startet' },
        { label: K.pa('binary_sensor.ki_vvb_boost_aktiv') ? 'Avbryt boost' : 'Boost varmtvann', icon: 'mdi:rocket-launch', dom: 'ki_energi', svc: K.pa('binary_sensor.ki_vvb_boost_aktiv') ? 'vvb_avbryt_boost' : 'vvb_boost', ok: 'Sendt' },
      ]) : note('Berederen har ingen bryter — termostaten styrer selv. Legionella bekreftes når en full oppvarmingssyklus er observert.'));
  }
  // Bad
  const HK = (K) => (k, d) => K.a('sensor.ki_hanklevarmer', k, d);
  function handkle(K, card) {
    const a = HK(K);
    const konfigurert = !!a('bryter', '');
    const ent = a('bryter', 'switch.hanklevarmer');
    const styr = K.pa('input_boolean.ki_styr_hanklevarmer');
    const pa = K.st(ent) ? K.st(ent).state === 'on' : K.s('sensor.ki_hanklevarmer', 'av') === 'pa';
    const effekt = Number(a('effekt_w', NaN));
    const maks = Number(a('maks_min', K.n('input_number.ki_hanklevarmer_maks_pa_tid')));
    const minutter = Number(a('minutter_pa', 0));
    const naerMaks = pa && isFinite(maks) && minutter > maks * 0.8;
    const iVindu = !!a('i_vindu', false);
    return list([
      row({ dot: naerMaks ? 'advarsel' : pa ? 'ok' : 'noytral', name: !konfigurert ? 'Ingen håndklevarmer valgt' : pa ? 'Varmer nå' : 'Står av', sub: a('forklaring', 'Velg bryter under Konfigurer → Utstyr'), v: isFinite(effekt) ? nf(effekt, 0) + ' W' : '–', act: 'k-more', data: { id: ent }, ent }),
      row({ name: 'Bryteren nå', sub: styr ? (iVindu ? 'I dusjvindu — styres av KI' : 'Manuell bruk slås av etter maks på-tid') : 'Slås på igjen automatisk', tog: pa, missing: !konfigurert, act: konfigurert ? 'k-tog' : null, data: { id: ent, kind: 'bryter' }, ent: konfigurert ? ent : null, haptic: 'selection' }),
      tog(K, card, 'input_boolean.ki_styr_hanklevarmer', 'KI styrer håndklevarmeren', 'Av = står på konstant'),
      step(K, card, 'input_number.ki_hanklevarmer_maks_pa_tid', 'Slå av etter', 0, 'min'),
      step(K, card, 'input_number.ki_hanklevarmer_effekt_w', 'Effekt når den er på', 0, 'W'),
    ]) + (naerMaks ? warn(`Har stått på i ${minutter} minutter. Sikkerhetsavstengingen slår inn ved ${nf(maks, 0)} minutter.`) : '');
  }
  function hkSparer(K) {
    const a = HK(K);
    return stats([[nf(Number(a('spart_kwh_i_dag', 0)), 2), 'kWh spart i dag'], [nf(Number(a('spart_kr_maned', 0)), 0) + ' kr', 'spart denne måneden'], [nf(Number(a('spart_kr_ar', 0)), 0) + ' kr', 'per år med dagens vinduer']])
      + note(`Mot å la den stå på hele døgnet: ${nf(Number(a('effekt_nominell_w', 46)), 0)} W × ${nf(24 - Number(a('pa_min_i_dag', 0)) / 60, 1)} t av i dag. Effekten læres fra målingen.`);
  }
  function dusj(K, card) {
    return dognplan(K, [{ navn: 'Håndklevarmer', spenn: [['input_datetime.ki_hanklevarmer_morgen_start', 'input_datetime.ki_hanklevarmer_morgen_slutt', 'ok', 'Morgen'], ['input_datetime.ki_hanklevarmer_kveld_start', 'input_datetime.ki_hanklevarmer_kveld_slutt', 'ok', 'Kveld']] }])
      + subsec(card, 'handkle-tider', 'Endre tider', list([
        step(K, card, 'input_datetime.ki_hanklevarmer_morgen_start', 'Morgen fra'),
        step(K, card, 'input_datetime.ki_hanklevarmer_morgen_slutt', 'Morgen til'),
        step(K, card, 'input_datetime.ki_hanklevarmer_kveld_start', 'Kveld fra'),
        step(K, card, 'input_datetime.ki_hanklevarmer_kveld_slutt', 'Kveld til'),
      ]) + note('Utenfor vinduene kan den slås på manuelt; da slås den av igjen etter maks på-tid. I rød effektsone utsettes starten noen minutter.'));
  }
  const minIgjen = (til) => { if (!til) return null; const d = new Date(til); return isNaN(d) ? null : Math.max(0, Math.round((d - Date.now()) / 60000)); };
  function harFukt(K) {
    const a = HK(K);
    const harAttr = a('har_fuktsensor', null);
    return harAttr !== null && harAttr !== undefined ? !!harAttr : isFinite(Number(a('fukt_na', NaN)));
  }
  function fukt(K, card) {
    if (!harFukt(K)) return null;
    const a = HK(K);
    const f = Number(a('fukt_na', NaN));
    const grense = Number(a('fukt_grense', K.n('input_number.ki_hanklevarmer_fukt_grense', 70)));
    const iVindu = !!a('i_fuktvindu', false);
    const andel = isFinite(f) && grense ? Math.max(0, Math.min(100, (f / grense) * 100)) : null;
    return (isFinite(f) ? list([row({ dot: iVindu ? 'ok' : f >= grense ? 'advarsel' : 'noytral', name: iVindu ? 'Tørker håndklær' : f >= grense ? 'Fuktig — teller ned' : 'Tørt på badet', sub: iVindu ? 'Vinduet står til fukten har lagt seg og håndklærne er tørre' : `Utløser ved ${nf(grense, 0)} %`, v: nf(f, 0) + ' %' })])
      + (andel !== null && !iVindu ? `<div class="kb-track sm"><i style="width:${andel.toFixed(0)}%;background:${f >= grense ? OR : B}"></i></div>` : '') : '')
      + list([
        tog(K, card, 'input_boolean.ki_hanklevarmer_fukt', 'Slå på etter dusj', 'Krever at fukten holder seg over grensen'),
        step(K, card, 'input_number.ki_hanklevarmer_fukt_grense', 'Fuktgrense', 0, '%', { sub: 'Hvor fuktig det må bli' }),
        step(K, card, 'input_number.ki_hanklevarmer_fukt_minutter', 'Varighet over grensen', 0, 'min', { sub: 'Minutter sammenhengende før den slår på' }),
        step(K, card, 'input_number.ki_hanklevarmer_fukt_timer', 'Står på i', 1, 't', { sub: 'Timer etter at vinduet åpnet' }),
      ]) + note('Fukten må ligge over grensen sammenhengende. Et øyeblikksmål ville slått på varmeren hver gang noen vasker hendene — det som skiller en dusj er at fukten blir stående. Faller den under før tiden er ute, teller den fra null igjen.');
  }
  function vifte(K, card) {
    const a = HK(K);
    if (!a('har_badvifte', null)) return null;
    const igjen = minIgjen(a('vifte_til', null));
    return (igjen ? list([row({ dot: 'ok', name: 'Lufter nå', sub: 'Startet av fukten etter dusj', v: igjen + ' min' })]) : '')
      + list([
        tog(K, card, 'input_boolean.ki_bad_vifte_fukt', 'Slå på vifta etter dusj', 'Samme fuktgrense som under «Etter dusj»'),
        step(K, card, 'input_number.ki_bad_vifte_minutter', 'Lufter i', 0, 'min', { sub: 'Minutter etter at fukten utløste' }),
      ]) + note('Vifta lufter ut, håndklevarmeren tørker håndklær — derfor minutter og ikke timer. Fuktgrensen er den samme som under «Etter dusj». Har du startet vifta selv, slår ikke motoren den av.');
  }
  const badGulv = (K) => soneListe(K).filter((l) => /bad/i.test(`${l.navn} ${l.rom || ''} ${l.key}`) && /gulv/i.test(`${l.type} ${l.navn}`));
  function gulv(K, card) {
    const soner = badGulv(K);
    if (!soner.length) return null;
    return list(soner.map((l) => {
      const h = HANDLING[l.venter ? 'venter' : l.handling] || { tekst: l.handling || '–', k: 'noytral' };
      return row({ dot: h.k, name: l.navn, chip: [h.tekst, h.k], sub: l.forklaring || '', v: `${l.naa != null ? nf(l.naa, 1) + '°' : '–'} · mål ${l.settpunkt ?? l.mal ?? '–'}°`, act: 'k-zone', data: { key: l.key, tab: 'soner' } });
    }));
  }

  /* ================================================================ LADING (_lading + _elbilVindu) */
  const LADE = { hold: ['Lader', 'ok'], endre: ['Justerer', 'ok'], start: ['Starter', 'ok'], stopp: ['Stopper', 'advarsel'], av: ['Står', 'noytral'], manuell: ['Manuell', 'noytral'], utilgjengelig: ['Svarer ikke', 'feil'], ingen: ['Ikke satt opp', 'noytral'], borte: ['Borte', 'noytral'] };
  const LA = (K) => (n, d) => K.a('sensor.ki_lading_status', n, d);
  function ladeStatus(K) {
    const st = K.st('sensor.ki_lading_status');
    if (!st) return note('Ladingen er ikke satt opp. Velg laderens bryter, bilens ladeeffekt og knappene for ladestrøm under Utstyr i integrasjonens innstillinger. Krever KI Energi 2.21.0 eller nyere.');
    const a = LA(K);
    const [tekst, klasse] = LADE[st.state] || [st.state, 'noytral'];
    const trinn = a('trinn_a', null), malt = a('malt_kw', null), satt = a('satt_trinn_a', null), soc = a('batteri_pst', null);
    const c = TONE[klasse];
    const forventet = satt ? Math.round(satt * 230) / 1000 : null;
    const avvik = (forventet != null && malt != null) ? forventet - malt : null;
    return `<div class="kb-ev"><span class="kb-ev-i" style="color:${at(c)};background:${al(c, 0.18)}">${M.icon('mdi:ev-station', 26)}</span>
      <div class="kb-ev-t"><span class="kb-cap" style="color:${at(c)}">${esc(tekst)}</span><b>${malt != null ? nf(Number(malt), 2) : '–'}<small> kW nå</small></b><span>${esc(a('forklaring', ''))}</span></div></div>`
      + stats([[trinn ? trinn + ' A' : '–', 'valgt trinn'], [satt ? satt + ' A' : '–', 'satt trinn'], [soc != null ? nf(soc, 0) + ' %' : '–', 'batteri']])
      + (avvik != null && Math.abs(avvik) >= 0.5 ? list([row({ dot: 'advarsel', name: 'Bilen tar mindre enn den får', sub: `Satt til ${satt} A (${nf(forventet, 2)} kW), tar ${nf(Number(malt), 2)} kW — nesten full eller kald. Differansen er gitt til varmen.`, v: nf(avvik, 2) + ' kW' })]) : '')
      + list([row({ dot: klasse, name: 'Handling', chip: [st.state, klasse], sub: trinn ? `Valgt trinn ${trinn} A` : 'Ingen lading nå', act: 'k-more', data: { id: 'sensor.ki_lading_status' }, ent: 'sensor.ki_lading_status' })]);
  }
  const ladeTrinn = (K) => { const t = LA(K)('trinn_tilgjengelig', []) || []; return t.length ? t : [6, 8, 10, 13, 16]; };
  function ladeLedig(K) {
    if (!K.st('sensor.ki_lading_status')) return null;
    const ledig = Number(LA(K)('ledig_kw', NaN));
    const trinn = ladeTrinn(K);
    const maks = Math.max(Math.round(Math.max(...trinn) * 230) / 1000 * 1.15, isFinite(ledig) ? ledig : 0, 1);
    return `<div class="kb-ledig"><div class="kb-track lg"><i style="width:${isFinite(ledig) ? Math.min(100, 100 * ledig / maks).toFixed(0) : 0}%;background:${G}"></i>${trinn.map((amp) => `<b style="left:${(100 * (amp * 230 / 1000) / maks).toFixed(1)}%" title="${amp} A"></b>`).join('')}</div>
      <div class="kb-tracktxt"><span>${isFinite(ledig) ? nf(ledig, 2) + ' kW ledig' : '–'}</span><span>strekene = trinnene</span></div></div>`
      + note('Det varmen, berederen og marginen ikke bruker. Bilen er husets siste last: den får bare det varmen ikke bruker, og fortrenger aldri en ovn.');
  }
  function ladeTrinnvelger(K) {
    if (!K.st('sensor.ki_lading_status')) return null;
    const a = LA(K);
    const ledig = Number(a('ledig_kw', NaN));
    const satt = a('satt_trinn_a', null);
    return `<div class="kb-amps">${ladeTrinn(K).map((amp) => {
      const kw = Math.round(amp * 230) / 1000;
      const passer = isFinite(ledig) && kw <= ledig;
      return `<button type="button" class="kb-amp${satt === amp ? ' on' : ''}${passer ? '' : ' dim'}" data-act="k-lade" data-amp="${amp}" data-haptic="off"><b>${amp} A</b><span>${nf(kw, 2)} kW</span></button>`;
    }).join('')}</div>` + note('230 V enfase. Dempede trinn får ikke plass i det ledige nå. Trykk = manuelt trinn (slår av automatikken). Motoren velger ellers det høyeste trinnet som holder seg under det ledige, og stopper ladingen når ikke engang laveste trinn får plass.');
  }
  function ladeAuto(K, card) {
    if (!K.st('sensor.ki_lading_status')) return null;
    const a = LA(K);
    const autoOn = K.st('input_boolean.ki_lading_automatikk') ? K.pa('input_boolean.ki_lading_automatikk') : !!a('automatikk', true);
    return list([
      row({ name: 'Automatikk', sub: 'Av = du styrer ladingen selv, motoren rører den ikke', tog: autoOn, act: 'k-tog', data: { id: 'input_boolean.ki_lading_automatikk', kind: 'bryter' }, ent: 'switch.ki_lading_automatikk', haptic: 'selection' }),
      step(K, card, 'input_number.ki_lading_min_mellom_min', 'Minste tid mellom endringer', 0, 'min', { sub: 'Hindrer at den justerer fram og tilbake' }),
      step(K, card, 'input_number.ki_lading_dodband_kw', 'Dødbånd', 1, 'kW', { sub: 'Nytt trinn velges bare når det gir mer enn dette' }),
      K.st('input_number.ki_lading_stopp_ved') ? step(K, card, 'input_number.ki_lading_stopp_ved', 'Stopp ved', 0, '%') : '',
      K.st('input_number.ki_lading_start_under') ? step(K, card, 'input_number.ki_lading_start_under', 'Start igjen under', 0, '%') : '',
      row({ name: 'Sist endret', sub: 'Hver endring gir bilen et lite avbrudd', v: klokke(a('sist_endret', null)) }),
    ]) + note('Begge sperrene er nødvendige fordi bilens effektsensor oppdaterer seg ved hver strømendring: uten dem ville hver måling utløst en ny endring, som utløste en ny måling.');
  }
  function ladeVindu(K, card) {
    if (!K.har('elbil')) return null;
    return dognplan(K, [{ navn: 'Lading', spenn: [['input_datetime.ki_elbil_fra', 'input_datetime.ki_elbil_til', 's', 'Elbil']] }])
      + list([
        tog(K, card, 'input_boolean.ki_elbil_natt', 'Lader om natten', 'Motoren holder av effekt i vinduet'),
        step(K, card, 'input_datetime.ki_elbil_fra', 'Lader fra'),
        step(K, card, 'input_datetime.ki_elbil_til', 'Til'),
        step(K, card, 'input_number.ki_elbil_effekt_kw', 'Ladeeffekt', 1, 'kW'),
      ]) + note('Dette er reservasjonen i effektbudsjettet for en lader som ikke styres av KI — noe annet enn styringen over, som setter ladestrøm selv. 5 A på tre faser (400 V) ≈ 3,5 kW, på én fase (230 V) ≈ 1,2 kW. Når lastprofilen har lært natten, teller halvparten.');
  }

  /* ================================================================ TANKER */
  function tenker(K) {
    const a = (n, d) => K.a('sensor.ki_energi_status', n, d);
    const tanker = a('tankegang', []) || [];
    const laster = K.laster();
    const senket = laster.filter((l) => l.handling === 'senket'), ov = laster.filter((l) => l.overstyrt);
    const resonnement = [
      ['Grensen denne timen', `${nf(Number(a('grense_kwh', NaN)), 2)} kWh`, a('grense_grunn', '')],
      ['Brukt så langt', `${nf(Number(a('forbrukt_kwh', NaN)), 2)} kWh`, `Kilde: ${a('malekilde', 'ukjent')}`],
      ['Tillatt snitt resten av timen', `${nf(Number(a('tillatt_effekt_kw', NaN)), 2)} kW`, `${a('minutter_igjen', '–')} minutter igjen`],
      ['Uregulert last nå', `${nf(Number(a('uregulert_kw', NaN)), 2)} kW`, `Om en time: ${nf(Number(a('uregulert_60_kw', NaN)), 2)} kW (innlært profil)`],
      ['Varmtvann', `${nf(Number(a('vvb_reservert_kw', NaN)), 2)} kW`, a('vvb_grunn', '')],
      ['Solbidrag stue', `${nf(Number(a('solfaktor', 0)), 2)}`, '0 = ingen sol, 1 = full klar sol på fasaden'],
      ['Ledig til varme', `${nf(Number(a('ledig_kw', NaN)), 2)} kW`, 'Etter reserver og prioriterte laster'],
    ];
    const moduser = [['input_boolean.ki_helgemodus', 'Helg'], ['input_boolean.ki_sommermodus', 'Sommer'], ['input_boolean.ki_hjemkomst_aktiv', 'Hjemkomst'], ['input_boolean.ki_skyggemodus', 'Skygge'],
      ['binary_sensor.ki_alle_borte', K.l('Alle borte')], ...K.personer.filter((p) => p.type === 'ungdom').map((p) => [`input_boolean.ki_${p.key}_ferie`, `${p.navn} ferie`])].filter(([id]) => K.pa(id)).map(([, n]) => n);
    const gard = K.st('sensor.ki_gardiner'), hank = K.s('sensor.ki_hanklevarmer', '');
    const min = Number(a('minutter_igjen', NaN));
    return concl(a('forklaring', '–'))
      + (tanker.length ? `<ul class="kb-ul">${tanker.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '')
      + list(resonnement.map(([n, v, s]) => row({ name: n, sub: s, v })))
      + sub('Sammendrag')
      + facts([fact(isFinite(min) ? min + ' min igjen av timen' : '–'), fact(`${nf(Number(a('forbrukt_kwh', NaN)), 2)} / ${nf(Number(a('grense_kwh', NaN)), 2)} kWh`),
        fact(`${nf(Number(K.a('sensor.ki_prognose', 'om_15_min_kw', NaN)), 1)} → ${nf(Number(K.a('sensor.ki_prognose', 'om_60_min_kw', NaN)), 1)} kW`),
        fact(senket.length ? senket.length + ' sone' + (senket.length > 1 ? 'r' : '') + ' senket' : 'ingen senket'),
        ...laster.filter((l) => l.handling === 'vindu').map((l) => fact(`${l.navn}: ${l.vindu_navn || 'vindu åpent'}`, 'feil')),
        ov.length ? fact(`${ov.length} overstyrt`) : '', fact(`Varmtvann: ${K.s('sensor.ki_bereder', '–')}`),
        hank ? fact(`Håndklevarmer ${hank === 'pa' ? 'på' : 'av'}`) : '',
        gard && gard.state !== 'ikke_konfigurert' ? fact(`Gardiner ${gard.state === 'av' ? 'manuelt' : gard.state}`) : '',
        moduser.length ? fact(moduser.join(' · ')) : '', a('skyggemodus', false) ? fact('skygge', 'noytral') : '', K.hytte ? fact('hytte', 'noytral') : '',
        ...senket.map((l) => fact(`${l.navn} ${l.settpunkt != null ? nf(l.settpunkt, 1) + '°' : ''}`, 'advarsel'))]);
  }
  function logg(K) {
    const linjer = K.a('sensor.ki_beslutningslogg', 'linjer', []) || [];
    if (!linjer.length) return note('Ingen beslutninger logget ennå. Motoren logger bare når den gjør noe, eller når det blir trangt.');
    const farge = (s) => (s === 'gronn' ? G : s === 'gul' ? Y : s === 'oransje' ? OR : R);
    const ut = linjer.slice(0, 30);
    return `<div class="kb-tl">${ut.map((l, i) => `<div class="kb-tl-i"><span class="kb-tl-d"><i style="background:${farge(l.sone)}"></i>${i < ut.length - 1 ? '<em></em>' : ''}</span>
      <span class="kb-tl-b"><span class="kb-tl-h"><span class="kb-tl-t">${esc(String(l.tid || '').slice(11, 16))}</span><b>${esc(SONE_TEKST[l.sone] || l.sone || '')}</b>${l.skygge ? chipHTML('skygge', 'noytral') : ''}<span class="kb-tl-v">${nf(l.forbrukt, 2)} / ${nf(l.grense, 2)} kWh</span></span>
      <span class="kb-rs">${esc(l.forklaring || '')}</span>${(l.tiltak || []).length ? `<ul class="kb-ul sm">${l.tiltak.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</span></div>`).join('')}</div>`;
  }
  function vurdering(K) {
    const laster = K.laster();
    if (!laster.length) return note('Motoren har ikke rapportert soner ennå.');
    return list(laster.map((l) => {
      const h = HANDLING[l.venter ? 'venter' : l.handling] || { tekst: l.handling || '–', k: 'noytral' };
      return row({ dot: h.k, nameHtml: esc(l.navn) + chipHTML(h.tekst, h.k) + (l.leggetid ? chipHTML('leggetid', 'noytral') : '') + (l.forvarm ? chipHTML('forvarmer', 'ok') : ''), sub: l.forklaring || '', v: nf(l.effekt, 2) + ' kW' });
    }));
  }
  function tau(K) {
    const t = K.a('sensor.ki_tidskonstanter', 'soner', {}) || {};
    if (!Object.keys(t).length) return null;
    return list(Object.entries(t).map(([navn, v]) => row({ name: navn, sub: `${v.malinger || 0} målinger${(v.malinger || 0) < 20 ? ' — lærer fortsatt' : ''}`, chip: (v.malinger || 0) < 20 ? ['Lærer fortsatt', 'advarsel'] : null, v: `${v.tau_timer ? nf(v.tau_timer, 1) + ' t' : '–'} · ${v.grader_per_time ? nf(v.grader_per_time, 1) + ' °C/t' : '–'}` })))
      + note('Tidskonstanten er hvor lenge rommet holder på overtemperaturen. Lang tidskonstant betyr at nattsenking sjelden lønner seg, fordi gjenoppvarmingen skjer til dyrere dagtariff.');
  }

  /* ================================================================ OPPSETT */
  const togs = (K, card, rows) => list(rows.map(([id, n, s, h]) => tog(K, card, id, n, s, { help: h })));
  function gardiner(K, card) {
    if (!K.har('gardiner')) return null;
    const st = K.st('sensor.ki_gardiner');
    const a = (k, d) => K.a('sensor.ki_gardiner', k, d);
    const styr = K.pa('input_boolean.ki_styr_gardiner');
    const tilstand = st ? st.state : 'ukjent';
    const klasse = !styr ? 'noytral' : tilstand === 'lukket' ? 'advarsel' : tilstand === 'apen' ? 'ok' : 'noytral';
    const navn = tilstand === 'ikke_konfigurert' ? 'Ingen gardin valgt' : !styr ? 'KI-styring av' : tilstand === 'lukket' ? 'Lukket' : tilstand === 'apen' ? 'Åpen' : 'Ingen styring nå';
    const v = uiGet(card, 'klima_gardin', 'sol');
    const cover = a('cover', '') || 'sensor.ki_gardiner';
    return list([row({ dot: klasse, name: navn, sub: `${a('forklaring', '–')}${a('neste', '') ? ' · ' + a('neste', '') : ''}`, v: a('faktisk', '') || '', act: 'k-more', data: { id: cover }, ent: cover })])
      + seg([['sol', 'Følg sola', 'mdi:weather-sunset'], ['klokke', 'Klokkeslett', 'mdi:clock-outline'], ['sesong', 'Sesong', 'mdi:calendar-range']], v, 'k-gseg')
      + (v === 'klokke' ? list([step(K, card, 'input_datetime.ki_gardin_apne_tidligst', 'Åpne tidligst'), step(K, card, 'input_datetime.ki_gardin_lukk_senest', 'Lukk senest')])
        + dognplan(K, [{ navn: 'Gardiner', spenn: [['input_datetime.ki_gardin_apne_tidligst', 'input_datetime.ki_gardin_lukk_senest', 'dag', 'Kan være åpne']] }])
        : v === 'sesong' ? manedStripe(K, card, 'input_number.ki_gardin_start_maned', 'input_number.ki_gardin_slutt_maned', 'Gardinsesong')
          + list([step(K, card, 'input_number.ki_gardin_start_maned', 'Fra måned', 0, ''), step(K, card, 'input_number.ki_gardin_slutt_maned', 'Til og med måned', 0, '')])
          + note('Utenfor sesongen styres gardinene bare i sommermodus (solskjerming når sola står høyt og det er over 22 °C).')
          : list([tog(K, card, 'input_boolean.ki_styr_gardiner', 'KI styrer gardinene', 'Lukkes når sola er nede i fyringssesongen, skjermer mot sol om sommeren'),
            tog(K, card, 'input_boolean.ki_gardin_folg_sol', 'Følg sola', 'På = åpnes først når sola er oppe. Av = bare klokkeslettene.'),
            step(K, card, 'input_number.ki_gardin_ute_grense', 'Hold lukket på dagen under', 0, '°C')]));
  }
  function lys(K, card) {
    const st = K.st('sensor.ki_lys');
    const regler = st ? (st.attributes.regler || []) : [];
    if (!regler.length) return null;
    const k = (s) => ({ i_bruk: 'ok', venter: 'advarsel', slatt_av: 'ok', satt: 'ok', holder: 'ok', manuell: 'noytral', av: 'noytral', av_lys: 'noytral', utenfor: 'noytral', mangler: 'feil' })[s] || 'noytral';
    return list(regler.map((r) => row({ dot: k(r.status), nameHtml: esc(r.navn) + chipHTML(r.type === 'demp' ? 'nattdemping' : 'glemt lys', r.type === 'demp' ? 'noytral' : 'ok') + (r.pa ? chipHTML('på' + (r.pa_min ? ' ' + r.pa_min + ' min' : ''), 'advarsel') : ''),
      sub: r.tekst || '', tog: !!r.aktiv, act: 'k-tog', data: { id: `input_boolean.ki_lys_${r.key}`, kind: 'veksle' }, ent: r.light || null, haptic: 'selection' })))
      + note('Regler legges til under Konfigurer → Lys. Lys med nærværssensor slås bare av etter fravær; uten sensor etter lang på-tid i tidsvinduet.');
  }
  const VARSLER = [['input_boolean.ki_varsel_effekt', 'Effektgrense', 'Når en time ender over grensen'], ['input_boolean.ki_varsel_helg', 'Helg', 'Fredagsspørsmål, søndagsspørsmål og helg satt automatisk'],
    ['input_boolean.ki_varsel_hjemkomst', 'Hjemkomst', 'Når oppvarmingen starter uten svar'], ['input_boolean.ki_varsel_sommer', 'Sommermodus', 'Når den slås av/på automatisk'],
    ['input_boolean.ki_varsel_vvb', 'Varmtvann', 'Lang oppvarming. Feil og forfalt legionella varsles alltid'], ['input_boolean.ki_varsel_hanklevarmer', 'Håndklevarmer', 'Sikkerhetsavstenging']];
  // 17.31: hovedbryter i topplinjen (lukket kort). Tilstanden avledes av radene: på = minst én varsel på (og hovedbryteren
  // for varsler, når den finnes, er på). Ingen egen lagret tilstand.
  function varslerMaster(K) {
    const hb = K.st('input_boolean.ki_energi_varsler'), rows = VARSLER.map(([id]) => id).filter((id) => K.st(id));
    const n = hb && hb.state !== 'on' ? 0 : rows.filter((id) => K.pa(id)).length;
    return { ids: rows, master: hb ? 'input_boolean.ki_energi_varsler' : null, on: n, total: rows.length };
  }
  function varslinger(K, card) {
    const pa = K.pa('input_boolean.ki_energi_varsler');
    const varsler = VARSLER;
    return list([tog(K, card, 'input_boolean.ki_energi_varsler', 'Varslinger', 'Hovedbryteren slår alt av. Mottakere velges under Konfigurer → Hus og varsler.')])
      + `<div class="${pa ? '' : 'kb-dim'}">${togs(K, card, varsler)}</div>` + note('Kritiske feil (berederen svarer ikke, legionellafrist passert) sendes uansett.');
  }
  function tider(K) {
    return dognplan(K, [
      { navn: 'Huset', spenn: [['input_datetime.ki_tid_dag_start', 'input_datetime.ki_tid_natt_start', 'dag', 'Dag']] },
      ...K.personer.filter((p) => p.type !== 'voksen').map((p, i) => (p.type === 'barn'
        ? { navn: p.navn, spenn: [[`input_datetime.ki_${p.key}_dag`, `input_datetime.ki_${p.key}_natt`, i % 2 ? 's' : 'c', 'Våken'], [`input_datetime.ki_${p.key}_borte_fra`, `input_datetime.ki_${p.key}_borte_til`, 'borte', 'Borte']] }
        : { navn: p.navn, spenn: [[`input_datetime.ki_${p.key}_vekking`, `input_datetime.ki_${p.key}_natt`, i % 2 ? 's' : 'c', 'Våken']] })),
      { navn: 'Stue', mark: [['input_datetime.ki_stue_reduksjon_fra', 'Reduksjon fra', 'advarsel']] },
    ]) + note('Strek = nå · varmen holdes oppe i de fargede båndene.');
  }
  function personer(K, card) {
    const pp = K.personer.filter((p) => p.type !== 'voksen');
    if (!pp.length) return null;
    return pp.map((p) => (p.type === 'barn'
      ? subsec(card, 'person-' + p.key, p.navn, list([step(K, card, `input_datetime.ki_${p.key}_dag`, 'Opp'), step(K, card, `input_datetime.ki_${p.key}_natt`, 'Legger seg'),
        step(K, card, `input_datetime.ki_${p.key}_borte_fra`, 'Borte fra'), step(K, card, `input_datetime.ki_${p.key}_borte_til`, 'Hjemme igjen')]), true, `<span class="kb-subm">${esc(tidKort(K, `input_datetime.ki_${p.key}_dag`))}–${esc(tidKort(K, `input_datetime.ki_${p.key}_natt`))}</span>`)
      : subsec(card, 'person-' + p.key, p.navn, list([step(K, card, `input_datetime.ki_${p.key}_vekking`, 'Vekking'), step(K, card, `input_datetime.ki_${p.key}_vekking_helg`, 'Vekking helg'),
        step(K, card, `input_datetime.ki_${p.key}_natt`, 'Legger seg'), tog(K, card, `input_boolean.ki_${p.key}_ferie`, 'Ferie', 'Bruker helgevekking hver dag')]), true, `<span class="kb-subm">${esc(tidKort(K, `input_datetime.ki_${p.key}_vekking`))}–${esc(tidKort(K, `input_datetime.ki_${p.key}_natt`))}${K.pa(`input_boolean.ki_${p.key}_ferie`) ? ' · ferie' : ''}</span>`))).join('');
  }
  function diagnostikk(K, card) {
    const diag = [['sensor.ki_uregulert_effekt', 'Uregulert effekt'], ['sensor.ki_styrt_effekt', 'Styrt effekt'],
      ...[['total_effekt', 'Total effekt'], ['importert_energi', 'Energiregister'], ['ute_temp', 'Utetemperatur'], ['vaer', 'Vær']].filter(([k]) => K.ent(k)).map(([k, n]) => [K.ent(k), n]),
      ['sensor.ki_energi_status', 'Motorstatus'], ['sensor.ki_laster', 'Laster'], ['sensor.ki_nettleie', 'Nettleie'], ['sensor.ki_bereder', 'Bereder'], ['sensor.ki_prognose', 'Prognose']];
    const maler = TIMESMALER_KANDIDATER.filter((id) => K.st(id));
    const brukt = K.a('sensor.ki_energi_status', 'malekilde', '');
    const ok = K.a('sensor.ki_energi_status', 'lagring_ok', null);
    return list([
      ...diag.map(([id, navn]) => { const st = K.st(id); return row({ dot: st ? 'ok' : 'feil', name: navn, chip: st ? ['OK', 'ok'] : ['Mangler', 'feil'], sub: id, v: st ? String(st.state).slice(0, 24) : 'finnes ikke', act: st ? 'k-more' : null, data: { id }, ent: st ? mapId(id) : null }); }),
      row({ dot: maler.length ? 'ok' : 'advarsel', name: 'Timesmåler i bruk', after: helpBtn(card, 'malekilde'), sub: maler.length ? maler.join(', ') : 'Ingen utility_meter funnet — motoren måler timen selv mot energiregisteret', v: maler.length ? K.s(maler[0]) : 'egen måling', act: maler.length ? 'k-more' : null, data: { id: maler[0] || '' } }) + helpBox(card, 'malekilde'),
      row({ dot: ok === true ? 'ok' : ok === false ? 'feil' : 'advarsel', name: 'Lagring av læring', after: helpBtn(card, 'lagring'), sub: `${K.a('sensor.ki_energi_status', 'lagring', 'ukjent')} · ${K.a('sensor.ki_energi_status', 'profil_oppforinger', 0)} profiloppføringer · ${K.a('sensor.ki_energi_status', 'tau_soner', 0)} soner`, act: 'k-more', data: { id: 'sensor.ki_energi_status' } }) + helpBox(card, 'lagring'),
    ]) + (brukt ? note(`Motoren rapporterer at den bruker: ${brukt}`) : '')
      + btns(card, [{ label: 'Kjør motoren nå', icon: 'mdi:play', dom: 'ki_energi', svc: 'tick', ok: 'Motoren kjørt' }, { label: 'Fjern alle overstyringer', icon: 'mdi:hand-back-right-off', dom: 'ki_energi', svc: 'fjern_overstyring', danger: true, ok: 'Alle overstyringer fjernet' }]);
  }

  /* ================================================================ AVANSERT */
  function prognoseStatus(K) {
    const st = K.st('sensor.ki_prognoselaering');
    if (!st) return 'Ingen data';
    return ({ laerer: 'Lærer', aktiv: 'Adaptiv margin aktiv', usikkert_grunnlag: 'Usikkert grunnlag', av: 'Fast reserve' })[st.state] || st.state;
  }
  function prognose(K, card) {
    const st = K.st('sensor.ki_prognoselaering');
    let top = '';
    if (st) {
      const a = st.attributes || {};
      const k = { laerer: 'advarsel', aktiv: 'ok', usikkert_grunnlag: 'advarsel', av: 'noytral' }[st.state] || 'noytral';
      const iv = a.prognoseintervall_kwh;
      top = stats([[nf(Number(a.forventet_slutt_kwh || 0), 2), 'forventet ved timeslutt (kWh)'], ['+' + nf(Number(a.kwh || 0), 2), 'usikkerhetsmargin (kWh)'], [nf(Number(a.strategisk_reserve_kwh || 0), 2), 'strategisk reserve (kWh, døgnmaks)']])
        + facts([fact(prognoseStatus(K), k), fact(`${a.n || 0} obs. (${a.horisont || '–'} min igjen${a.kilde === 'segment' ? ', ' + String(a.segment || '').replace('_', ' ') : ''})`),
          iv ? fact(`intervall ${nf(iv[0], 2)}–${nf(iv[1], 2)} kWh (P20–P80, ingen garanti)`) : '', a.dekning_observert != null ? fact(`innenfor margin ${nf(100 * a.dekning_observert, 0)} % av ${a.n_dekning}`) : '',
          a.n_pavirket ? fact(`${a.n_pavirket} holdt utenfor (egne tiltak)`) : '']) + concl(a.grunn || '');
    }
    return top + list([
      tog(K, card, 'input_boolean.ki_adaptiv_reserve', 'Adaptiv reserve', 'Lærer usikkerhetsmargin for timen av prognosefeil. Av = fast reserve under'),
      step(K, card, 'input_number.ki_reserve_uregulert_kwh', 'Fast reserve (fallback)', 2, 'kWh'),
      step(K, card, 'input_number.ki_prognose_margin_min', 'Margin minimum', 2, 'kWh'),
      step(K, card, 'input_number.ki_prognose_margin_maks', 'Margin maksimum', 2, 'kWh'),
      step(K, card, 'input_number.ki_prognose_min_obs', 'Minste grunnlag', 0, 'obs'),
    ]) + btns(card, [{ label: 'Nullstill prognoselæring', icon: 'mdi:restore', dom: 'ki_energi', svc: 'nullstill_prognoselaering', danger: true, ok: 'Prognoselæringen er nullstilt' }])
      + list([step(K, card, 'input_number.ki_reserve_frokost_kwh', 'Reserve frokost', 1, 'kW'), step(K, card, 'input_number.ki_reserve_middag_kwh', 'Reserve middag', 1, 'kW')])
      + sub('Måltidsvinduer')
      + dognplan(K, [{ navn: 'Måltider', spenn: [['input_datetime.ki_frokost_start', 'input_datetime.ki_frokost_slutt', 'ok', 'Frokost'], ['input_datetime.ki_middag_start', 'input_datetime.ki_middag_slutt', 'ok', 'Middag']] }])
      + list([step(K, card, 'input_datetime.ki_frokost_start', 'Frokost fra'), step(K, card, 'input_datetime.ki_frokost_slutt', 'Frokost til'), step(K, card, 'input_datetime.ki_middag_start', 'Middag fra'), step(K, card, 'input_datetime.ki_middag_slutt', 'Middag til')])
      + note('Måltidsreservene brukes bare til lastprofilen har nok målinger for timen. Etter det vet motoren selv hva komfyren pleier å trekke.');
  }
  function moduser(K, card) {
    return list([step(K, card, 'input_number.ki_temp_helg', K.l('Helgetemperatur'), 1, '°C'), step(K, card, 'input_number.ki_temp_helg_gulvvarme', K.l('Helg gulvvarme'), 1, '°C'),
      step(K, card, 'input_number.ki_temp_helg_bad', K.l('Helg bad'), 1, '°C'), step(K, card, 'input_number.ki_temp_sommer', 'Sommertemperatur', 1, '°C')])
      + sub('Sommer')
      + manedStripe(K, card, 'input_number.ki_sommer_start_maned', 'input_number.ki_sommer_slutt_maned', 'Sommermodus')
      + list([step(K, card, 'input_number.ki_sommer_start_maned', 'Sommer fra måned', 0, ''), step(K, card, 'input_number.ki_sommer_slutt_maned', 'Sommer til måned', 0, ''),
        step(K, card, 'input_number.ki_sommer_ute_grense', 'Sommer når ute over', 0, '°C'), step(K, card, 'input_number.ki_helg_auto_timer', 'Helg auto etter', 0, 't borte')])
      + note('Forvarming bruker motorens målte oppvarmingsrate per sone. Sonene starter så sent som mulig innenfor budsjettet, og gulvvarme aldri senere enn 45 minutter før fristen.');
  }
  function helgevarsler(K, card) {
    const venter = K.pa('input_boolean.ki_helg_venter_svar');
    return note(K.hytte ? '«Skal dere på hytta i helgen?» sendes torsdag og fredag når hytta er tom. Svarer dere ja, holdes frostsikringen til oppvarmingen må starte for å være ferdig til ankomsttiden fredag.'
      : '«Skal dere bort i helgen?» sendes torsdag og fredag, bare hvis dere er hjemme. Svarer dere ja, settes sparemodus i det siste person drar.')
      + dognplan(K, [{ navn: 'Torsdag', mark: [['input_datetime.ki_helg_varsel_tid_torsdag', 'Spør', 'noytral']] }, { navn: 'Fredag', mark: [['input_datetime.ki_helg_varsel_tid', 'Spør', 'noytral']] },
        { navn: 'Søndag', spenn: [['input_datetime.ki_helg_sporsmal_tid', 'input_datetime.ki_helg_frist_tid', 'advarsel', 'Svarfrist'], ['input_datetime.ki_helg_frist_tid', 'input_datetime.ki_hjemkomst_tid', 'dag', 'Oppvarming']], mark: [['input_datetime.ki_hjemkomst_tid', 'Hjemme', 'ok']] }])
      + list([
        tog(K, card, 'input_boolean.ki_helg_spor_torsdag', 'Spør torsdag', ''), step(K, card, 'input_datetime.ki_helg_varsel_tid_torsdag', 'Torsdag kl.'),
        tog(K, card, 'input_boolean.ki_helg_spor_fredag', 'Spør fredag', ''), step(K, card, 'input_datetime.ki_helg_varsel_tid', 'Fredag kl.'),
        step(K, card, 'input_datetime.ki_helg_sporsmal_tid', 'Søndag spør'), step(K, card, 'input_datetime.ki_helg_frist_tid', 'Søndag frist'),
        step(K, card, 'input_datetime.ki_hjemkomst_tid', K.l('Forventet hjemkomst')),
        row({ dot: venter ? 'advarsel' : 'noytral', name: 'Venter på svar', after: helpBtn(card, 'venter_svar'), v: venter ? 'Ja' : 'Nei', act: 'k-more', data: { id: 'input_boolean.ki_helg_venter_svar' }, ent: 'switch.ki_helg_venter_svar' }) + helpBox(card, 'venter_svar'),
      ])
      + btns(card, [{ label: 'Send spørsmålet nå', icon: 'mdi:send', dom: 'ki_energi', svc: 'helg_sporsmal', ok: 'Spørsmålet er sendt' },
        { label: K.l('Start hjemkomst'), icon: 'mdi:home-import-outline', dom: 'ki_energi', svc: 'hjemkomst', ok: 'Oppvarmingen starter' },
        { label: K.l('Avslutt hjemkomst'), icon: 'mdi:home-check-outline', dom: 'ki_energi', svc: 'hjemkomst_ferdig', ok: 'Avsluttet' }]);
  }
  function vvbAvansert(K, card) {
    return list([
      step(K, card, 'input_number.ki_vvb_metning_terskel_w', 'Effektgrense for utkoblet termostat', 0, 'W'),
      step(K, card, 'input_number.ki_vvb_metning_minutter', 'Minutter null effekt før mettet', 0, 'min'),
      step(K, card, 'input_number.ki_vvb_maks_dager', 'Hard legionellafrist', 0, 'd'),
      ...(K.har('vvb_bryter') ? [step(K, card, 'input_number.ki_vvb_maks_min_uten_effekt', 'Minutter uten effekt = allerede varm', 0, 'min'),
        step(K, card, 'input_number.ki_vvb_maks_oppvarming_min', 'Maks sammenhengende oppvarming', 0, 'min'), step(K, card, 'input_number.ki_vvb_effekt_kw', 'Antatt effekt', 1, 'kW'),
        step(K, card, 'input_number.ki_vvb_boost_minutter', 'Boost varighet', 0, 'min')]
        : [step(K, card, 'input_number.ki_vvb_min_syklus_min', 'Minste oppvarming for godkjent syklus', 0, 'min')]),
    ]) + note('Terskelen avgjør hva som regnes som en reell oppvarming. Står den for lavt, telles standby som en syklus og legionellasikringen blir bekreftet på falskt grunnlag.');
  }
  function tariff(K, card) {
    const tabell = K.a('sensor.ki_nettleie', 'tabell', []) || [];
    const naa = K.a('sensor.ki_nettleie', 'registrert_trinn_kr', null);
    const s = K.st('input_text.ki_tariff_tabell');
    const val = K.s('input_text.ki_tariff_tabell', '');
    const inp = M.pickerInputHTML ? M.pickerInputHTML({ value: val, placeholder: '2:150,5:250,10:420,15:585,20:755', cls: 'kb-text', inputmode: 'text', label: 'Tarifftabell', attrs: `data-input="k-text" data-id="input_text.ki_tariff_tabell"${s ? '' : ' disabled'}` })
      : `<input class="kb-text" type="text" inputmode="text" autocapitalize="off" value="${esc(val)}" placeholder="2:150,5:250,10:420,15:585,20:755" data-input="k-text" data-id="input_text.ki_tariff_tabell"${s ? '' : ' disabled'}>`;
    return `<div class="kb-inrow">${inp}</div>${s ? '' : note('text.ki_tariff_tabell finnes ikke.')}`
      + (tabell.length ? `<div class="kb-tariff">${tabell.map(([g, k], i, a) => `<div class="${naa === k ? 'on' : ''}"><span>${i ? esc(a[i - 1][0]) : 0}–${esc(g)} kW</span><b>${esc(k)} kr</b>${naa === k ? '<em>dagens trinn</em>' : ''}</div>`).join('')}</div>` : note('Tabellen fylles fra sensor.ki_nettleie.'));
  }
  function entiteter(K, card) {
    const lasterAlle = soneListe(K);
    const entMap = {};
    lasterAlle.forEach((l) => { entMap[l.key] = l.entiteter && l.entiteter.length ? l.entiteter : (SONE_ENTITETER[l.key] || []); });
    const soner = Object.keys(entMap);
    if (!soner.length) return note('Motoren har ikke rapportert soner ennå.');
    const kb = S(card);
    return soner.map((k) => {
      const liste = entMap[k] || [];
      const mangler = liste.filter((id) => !K.st(id));
      const apen = kb.eopen.has(k);
      const navn = (lasterAlle.find((l) => l.key === k) || {}).navn || k;
      return `<div class="kb-eg${apen ? ' open' : ''}">${row({ dot: mangler.length ? 'feil' : 'ok', name: navn, sub: mangler.length ? mangler.length + ' entitet(er) mangler' : 'alle på plass', act: 'k-eopen', data: { key: k }, v: String(liste.length), after: '' })}
        ${apen ? list(liste.map((id) => { const st = K.st(id); return row({ dot: st ? 'ok' : 'feil', name: id, v: st ? String(st.state).slice(0, 20) : 'mangler', act: st ? 'k-more' : null, data: { id }, ent: st ? id : null, cls: st ? '' : 'kb-err' }); })) : ''}</div>`;
    }).join('');
  }
  function raa(K) {
    const attr = (K.st('sensor.ki_energi_status') || {}).attributes || {};
    const skjul = ['friendly_name', 'icon', 'forklaring', 'endringer', 'laster', 'linjer'];
    const rader = [];
    for (const k of Object.keys(attr)) {
      if (skjul.includes(k)) continue;
      let v = attr[k];
      if (v && typeof v === 'object') v = JSON.stringify(v);
      if (typeof v === 'boolean') v = v ? 'ja' : 'nei';
      rader.push([k, String(v)]);
    }
    if (!rader.length) return note('sensor.ki_energi_status finnes ikke.');
    return `<div class="kb-raw">${rader.map(([k, v]) => `<div><span>${esc(k)}</span><code>${esc(v)}</code></div>`).join('')}</div>`;
  }
  function handlinger(K, card) {
    return btns(card, [
      { label: 'Kjør motoren nå', icon: 'mdi:play', dom: 'ki_energi', svc: 'tick', ok: 'Motoren kjørt' },
      { label: 'Fjern alle overstyringer', icon: 'mdi:hand-back-right-off', dom: 'ki_energi', svc: 'fjern_overstyring', danger: true, ok: 'Alle overstyringer fjernet' },
      { label: 'Nullstill tidskonstanter', icon: 'mdi:school-outline', dom: 'ki_energi', svc: 'nullstill_laering', data: { hva: 'tau' }, danger: true, ok: 'Tidskonstantene er nullstilt' },
      { label: 'Nullstill lastprofil', icon: 'mdi:chart-bell-curve', dom: 'ki_energi', svc: 'nullstill_laering', data: { hva: 'profil' }, danger: true, ok: 'Lastprofilen er nullstilt' },
      { label: 'Sett standardverdier', icon: 'mdi:restore', dom: 'ki_energi', svc: 'sett_standardverdier', danger: true, ok: 'Standardverdier satt' },
    ]) + `<div class="kb-row"><div class="kb-rt"><div class="kb-rn">Om standardverdier${helpBtn(card, 'standardverdier')}</div></div></div>` + helpBox(card, 'standardverdier');
  }

  /* ================================================================ blokk-tabellen */
  // Stabile id-er (ikke titler). fixed = fast toppblokk (kan skjules, ikke flyttes). body → null skjuler blokken.
  const BLOCKS = {
    oversikt: [
      { id: 'siste12', title: 'Siste 12 timer', icon: 'mdi:chart-bar', fixed: true, meta: (K) => { const g = Number(K.a('sensor.ki_energi_status', 'grense_kwh', NaN)); return isFinite(g) ? `grense ${nf(g, 2)} kWh` : 'Forbruk per time mot grensen'; }, body: siste12 },
      { id: 'forventet', title: 'Forventet effekt', icon: 'mdi:chart-bell-curve', fixed: true, meta: () => 'uregulert + varmtvann + varme', body: forventet },
      { id: 'leggetid', title: 'Leggetid', icon: 'mdi:bed', fixed: true, help: 'leggetid', show: (K) => K.laster().some((l) => l.person && (l.person_type === 'barn' || l.person_type === 'ungdom')), meta: (K) => { const a = K.laster().filter((l) => l.person && l.leggetid); return a.length ? a.map((l) => l.navn).join(', ') + ' senket' : 'trykk når noen legger seg'; }, body: leggetid },
      { id: 'styrer', title: 'Hvem styrer ovnene', icon: 'mdi:account-cog', meta: (K) => { const sk = K.pa('input_boolean.ki_skyggemodus'), m = K.pa('input_boolean.ki_energi_hovedbryter'); return `${m && !sk ? 'Energimotoren' : sk ? 'Skyggemodus' : 'Av'} · ${K.a('sensor.ki_energi_status', 'modus', K.s('sensor.ki_klima_status', ''))}`; }, body: (K, c) => styrer(K, c, false) },
      { id: 'tiltak', title: 'Tiltak akkurat nå', icon: 'mdi:lightning-bolt', show: (K) => K.laster().some((l) => l.handling === 'senket'), meta: (K) => `${K.laster().filter((l) => l.handling === 'senket').length} sone(r) senket`, body: tiltak },
      { id: 'budsjett', title: 'Timebudsjett', icon: 'mdi:timer-sand', help: 'tillatt_effekt', helpExtra: (K) => { const kilde = K.a('sensor.ki_energi_status', 'malekilde', ''); return (kilde ? 'Måling: ' + kilde + '. ' : '') + (K.a('sensor.ki_energi_status', 'tak_aktivt', false) ? 'Regnestykket ga høyere tillatt effekt enn timegrensen fordi det er få minutter igjen av timen; verdien er kuttet ned til grensen.' : ''); }, meta: (K) => `${K.a('sensor.ki_energi_status', 'minutter_igjen', '–')} min igjen`, body: budsjett },
      { id: 'varmtvann', title: 'Varmtvann', icon: 'mdi:water-boiler', meta: (K) => K.s('sensor.ki_vvb_legionella_status', 'ukjent'), body: (K, c) => vvbStatusRows(K, c, true) },
      { id: 'borte', title: 'Bortemodus', icon: 'mdi:bag-suitcase', meta: (K) => (K.a('sensor.ki_tilstedevaerelse', 'venter_svar', false) ? 'Venter på svar om helgen' : K.pa('input_boolean.ki_helg_auto') ? 'slår seg på automatisk' : ''), body: borte },
    ],
    soner: [
      { id: 'soner', title: 'Soner', icon: 'mdi:floor-plan', meta: () => 'trykk for settpunkt og overstyring', body: soneGrid },
    ],
    energi: [
      { id: 'dynamisk', title: 'Dynamisk grense', icon: 'mdi:arrow-expand-vertical', fixed: true, help: 'dynamisk_grense', helpExtra: (K) => { const N = N_(K); return [(N('datakvalitet_grunner', []) || []).join('. '), (N('reserve_grunner', []) || []).join(', ')].filter(Boolean).join('. '); }, show: (K) => !!K.st('sensor.ki_nettleie'), meta: (K) => { const N = N_(K); return `${kr(N('registrert_trinn_kr', null))}/mnd${N('registrert_trinn_til', null) ? ' · neste trinn ved ' + nf(N('registrert_trinn_til'), 0) + ' kW' : ''}`; }, body: dynamisk },
      { id: 'sparer', title: 'KI sparer', icon: 'mdi:piggy-bank-outline', fixed: true, help: 'sparing', helpExtra: (K) => K.a('sensor.ki_sparing', 'merknad', ''), show: (K) => !!K.st('sensor.ki_sparing'), meta: (K) => `${nf(Number(K.a('sensor.ki_sparing', 'total_kr_maned', 0)), 0)} kr · ${nf(Number(K.a('sensor.ki_sparing', 'total_kwh_maned', 0)), 1)} kWh denne måneden`, body: sparer },
      { id: 'maaned', title: 'Månedens tall', icon: 'mdi:calendar-month', fixed: true, meta: () => 'estimat, ikke måling', body: maaned },
      { id: 'topp3', title: 'Topp tre denne måneden', icon: 'mdi:podium', show: (K) => !!K.st('sensor.ki_nettleie'), meta: (K) => `${(N_(K)('topp_tre', []) || []).map((t) => nf(t.kwh, 2)).join(' / ') || '–'} kWh`, body: topp3 },
      { id: 'effekt6', title: 'Effekt siste 6 timer', icon: 'mdi:chart-areaspline', meta: () => 'uregulert mot styrt', body: effekt6 },
      { id: 'grenser', title: 'Grenser', icon: 'mdi:speedometer', help: ['shed', 'komfortvekt'], body: grenser },
    ],
    vann: [
      { id: 'status', group: 'bereder', title: 'Varmtvann', icon: 'mdi:water-boiler', meta: (K) => K.s('sensor.ki_vvb_legionella_status', 'ukjent'), body: vvbHoved },
      { id: 'pris', group: 'bereder', title: 'Prisstyring', icon: 'mdi:cash-clock', help: 'vvb_billige', show: (K) => K.har('vvb_bryter'), meta: (K) => [K.pa('binary_sensor.ki_vvb_billig_time_na') ? 'Billig time nå' : 'Venter', billigstKl(K)].filter(Boolean).join(' · '), body: vvbPris },
      { id: 'brytere', group: 'bereder', title: 'Brytere', icon: 'mdi:toggle-switch', body: vvbBrytere },
      { id: 'handling', group: 'bereder', title: 'Boost og syklus', icon: 'mdi:gesture-tap', help: 'vvb_handling', show: (K) => K.har('vvb_bryter'), body: vvbHandling },
      { id: 'vindu', group: 'bereder', title: 'Oppvarmingsvindu', icon: 'mdi:clock-outline', show: (K) => K.har('vvb_bryter'), meta: (K) => `${tidKort(K, 'input_datetime.ki_vvb_vindu_start')}–${tidKort(K, 'input_datetime.ki_vvb_klar_innen')}`, body: vvbVindu },
      { id: 'legionella', group: 'bereder', title: 'Legionellasikring', icon: 'mdi:bacteria-outline', help: 'vvb_syklus', meta: (K) => legio(K).tekst, body: vvbLegionella },
      { id: 'handkle', group: 'bad', title: 'Håndklevarmer', icon: 'mdi:radiator', help: 'handkle', meta: (K) => { const a = HK(K); const pa = (K.st(a('bryter', 'switch.hanklevarmer')) || {}).state === 'on'; const m = Number(a('minutter_pa', 0)); return !a('bryter', '') ? 'Ikke satt opp' : pa ? 'På' + (m ? ' i ' + m + ' min' : '') : 'Av'; }, body: handkle },
      { id: 'hk_sparer', group: 'bad', title: 'KI sparer', icon: 'mdi:piggy-bank-outline', meta: (K) => `${nf(Number(HK(K)('spart_kr_maned', 0)), 0)} kr denne måneden`, body: hkSparer },
      { id: 'dusj', group: 'bad', title: 'Dusjvinduer', icon: 'mdi:shower-head', meta: (K) => [HK(K)('morgen', ''), HK(K)('kveld', '')].filter(Boolean).join(' · '), body: dusj },
      { id: 'fukt', group: 'bad', title: 'Etter dusj', icon: 'mdi:water-percent', show: harFukt, meta: (K) => { const a = HK(K); const f = Number(a('fukt_na', NaN)); const ig = minIgjen(a('fukt_til', null)); return a('i_fuktvindu', false) && ig !== null ? `${ig} min igjen` : isFinite(f) ? `${nf(f, 0)} % nå` : 'Ingen måling'; }, body: fukt },
      { id: 'vifte', group: 'bad', title: 'Baderomsvifte', icon: 'mdi:fan', show: (K) => !!HK(K)('har_badvifte', null), meta: (K) => { const ig = minIgjen(HK(K)('vifte_til', null)); return ig ? `lufter, ${ig} min igjen` : K.pa('input_boolean.ki_bad_vifte_fukt') ? 'klar' : 'av'; }, body: vifte },
      { id: 'gulv', group: 'bad', title: 'Bad gulvvarme', icon: 'mdi:heating-coil', show: (K) => badGulv(K).length > 0, meta: (K) => { const l = badGulv(K)[0]; return l ? `${l.naa != null ? nf(l.naa, 1) + '°' : '–'} · mål ${l.settpunkt ?? l.mal ?? '–'}°` : ''; }, body: gulv },
    ],
    lading: [
      { id: 'status', title: 'Elbillader', icon: 'mdi:ev-station', meta: (K) => { const s = K.st('sensor.ki_lading_status'); return s ? (LADE[s.state] || [s.state])[0] : 'Ikke satt opp'; }, body: ladeStatus },
      { id: 'ledig', title: 'Ledig effekt', icon: 'mdi:flash-outline', show: (K) => !!K.st('sensor.ki_lading_status'), meta: (K) => { const v = Number(LA(K)('ledig_kw', NaN)); return isFinite(v) ? nf(v, 2) + ' kW' : '–'; }, body: ladeLedig },
      { id: 'trinn', title: 'Ladestrøm', icon: 'mdi:current-ac', show: (K) => !!K.st('sensor.ki_lading_status'), meta: () => '230 V enfase', body: ladeTrinnvelger },
      { id: 'auto', title: 'Automatikk', icon: 'mdi:robot-outline', show: (K) => !!K.st('sensor.ki_lading_status'), meta: (K) => ((K.st('input_boolean.ki_lading_automatikk') ? K.pa('input_boolean.ki_lading_automatikk') : LA(K)('automatikk', true)) ? 'på' : 'av'), body: ladeAuto },
      { id: 'vindu', title: 'Ladevindu', icon: 'mdi:clock-outline', show: (K) => K.har('elbil'), meta: (K) => `${tidKort(K, 'input_datetime.ki_elbil_fra')}–${tidKort(K, 'input_datetime.ki_elbil_til')}`, body: ladeVindu },
    ],
    tanker: [
      { id: 'tenker', title: 'Slik tenker motoren nå', icon: 'mdi:head-cog', body: tenker },
      { id: 'logg', title: 'Beslutningslogg', icon: 'mdi:text-box-outline', meta: (K) => `${(K.a('sensor.ki_beslutningslogg', 'linjer', []) || []).length} oppføringer`, body: logg },
      { id: 'vurdering', title: 'Vurdering per sone', icon: 'mdi:home-thermometer', meta: () => 'sortert som motoren prioriterer', body: vurdering },
      { id: 'tau', title: 'Innlærte tidskonstanter', icon: 'mdi:school-outline', help: 'tidskonstant', show: (K) => Object.keys(K.a('sensor.ki_tidskonstanter', 'soner', {}) || {}).length > 0, meta: () => 'treghet · oppvarming · målinger', body: tau },
    ],
    oppsett: [
      { id: 'motor', title: 'Motor', icon: 'mdi:engine', body: (K, c) => togs(K, c, [['input_boolean.ki_energi_hovedbryter', 'Energimotor', 'Hovedbryter for hele integrasjonen'], ['input_boolean.ki_skyggemodus', 'Skyggemodus', 'Regner og logger, styrer ingenting', 'skyggemodus'],
        ['input_boolean.ki_dynamisk_grense', 'Dynamisk grense', 'Regner mot snittet av tre topper'], ['input_boolean.ki_laering_tau', 'Lær tidskonstanter', 'Måler hvor fort hver sone varmer og kjøler'],
        ['input_boolean.ki_adaptiv_reserve', 'Adaptiv reserve', 'Lærer usikkerhetsmarginen av prognosefeil'],
        ['input_boolean.ki_gradvis_gjenoppvarming', 'Gradvis gjenoppvarming', 'Senkede soner slippes én om gangen når grensen letter — ingen ny topp etter timeskiftet'],
        ['input_boolean.ki_auto_soveromsmodus', 'Automatisk soveromsmodus', 'Søvnsensor (KI Søvn) styrer natt-temperaturen — sover = senk nå, våken = hold dag til hen sovner']]) },
      { id: 'varme', title: 'Varme og komfort', icon: 'mdi:radiator', body: (K, c) => togs(K, c, [['input_boolean.ki_prediktiv_forvarming', 'Prediktiv forvarming', 'Starter ut fra målt oppvarmingsrate'], ['input_boolean.ki_solkompensasjon', 'Solkompensasjon', 'Trekker fra solvarme i stua'],
        ['input_boolean.ki_vindu_stopp', 'Vindu åpent stopper varme', 'Sonen settes ned når et vindu/dør står åpent'], ['input_boolean.ki_nattsenk_aktiv', 'Nattsenking', 'Av = ingen soner senkes om natten'],
        ['input_boolean.ki_nattsenk_okonomi', 'Økonomisk nattsenking', 'Senker bare når sparingen slår gjenoppvarmingen'], ...(K.har('gardiner') ? [['input_boolean.ki_styr_gardiner', 'Styr gardiner', 'Se egen blokk «Gardiner stue»']] : [])]) },
      { id: 'gardiner', title: 'Gardiner stue', icon: 'mdi:curtains', help: 'gardiner', show: (K) => K.har('gardiner'), meta: (K) => (K.a('sensor.ki_gardiner', 'i_sesong', false) ? 'Sesong ' + K.a('sensor.ki_gardiner', 'sesong', '') : 'Utenfor sesong'), body: gardiner },
      { id: 'helg', title: 'Helg og sommer', icon: 'mdi:calendar-weekend', body: (K, c) => togs(K, c, [['input_boolean.ki_helg_auto', K.l('Helg automatisk ved fravær'), K.l('Torsdag/fredag etter lengre fravær')], ['input_boolean.ki_helg_senk_gulvvarme', K.l('Helg senk gulvvarme'), 'Gulvvarmen senkes også i helgemodus'], ['input_boolean.ki_sommer_auto', 'Sommermodus automatisk', 'Etter måned og utetemperatur']]) },
      { id: 'vannbad', title: 'Vann og bad', icon: 'mdi:shower', body: (K, c) => togs(K, c, [...(K.har('vvb_bryter') ? [['input_boolean.ki_vvb_prisstyring', 'VVB prisstyring', 'Velger de billigste timene'], ['input_boolean.ki_vvb_alltid_pa', 'VVB alltid på', 'Kobler ut prisstyringen']] : []),
        ['input_boolean.ki_vvb_legionella_aktiv', 'Legionellasikring', 'Kan ikke blokkeres av sparing når den er på'], ...(K.har('hanklevarmer') ? [['input_boolean.ki_styr_hanklevarmer', 'Styr håndklevarmer', 'Dusjvinduer og sikkerhetsavstenging']] : [])]) },
      { id: 'lys', title: 'Lys', icon: 'mdi:lightbulb-group-outline', help: 'lys', show: (K) => { const s = K.st('sensor.ki_lys'); return !!(s && (s.attributes.regler || []).length); }, meta: (K) => `${nf(Number(K.a('sensor.ki_lys', 'spart_kr_maned', 0)), 0)} kr spart denne måneden`, body: lys },
      { id: 'varslinger', title: 'Varslinger', icon: 'mdi:bell-ring-outline', meta: (K) => (K.pa('input_boolean.ki_energi_varsler') ? 'på' : 'av'), master: varslerMaster, body: varslinger },
      { id: 'tider', title: 'Tider', icon: 'mdi:clock-outline', meta: () => 'døgnet i huset', body: tider },
      { id: 'dagnatt', title: 'Dag og natt', icon: 'mdi:theme-light-dark', meta: (K) => `${tidKort(K, 'input_datetime.ki_tid_dag_start')}–${tidKort(K, 'input_datetime.ki_tid_natt_start')}`, body: (K, c) => list([step(K, c, 'input_datetime.ki_tid_dag_start', 'Dag starter'), step(K, c, 'input_datetime.ki_tid_natt_start', 'Natt starter'), step(K, c, 'input_number.ki_natt_senk_ute_grense', 'Nattsenk kun under', 0, '°C')]) },
      { id: 'personer', title: 'Ferie og personer', icon: 'mdi:account-group', show: (K) => K.personer.some((p) => p.type !== 'voksen'), meta: (K) => K.personer.filter((p) => p.type !== 'voksen').map((p) => p.navn).join(', '), body: personer },
      { id: 'stue', title: 'Stue og vindu', icon: 'mdi:sofa', body: (K, c) => list([step(K, c, 'input_datetime.ki_stue_reduksjon_fra', 'Stue reduksjon fra'), step(K, c, 'input_number.ki_stue_reduksjon', 'Stue reduksjon', 1, '°C'),
        step(K, c, 'input_number.ki_vindu_forsinkelse_min', 'Vindu: vent før senking', 0, 'min'), step(K, c, 'input_number.ki_vindu_temp', 'Vindu: hold temperatur', 1, '°C'), step(K, c, 'input_number.ki_gjenoppvarming_intervall_min', 'Gjenoppvarming: intervall mellom soner', 0, 'min')]) },
      { id: 'diagnostikk', title: 'Diagnostikk', icon: 'mdi:stethoscope', meta: () => 'kilder og rå tilstand', body: diagnostikk },
    ],
    avansert: [
      { id: 'terskler', title: 'Terskler for fargesonene', icon: 'mdi:palette', meta: () => 'prosent av tillatt effekt', body: (K, c) => list([step(K, c, 'input_number.ki_sone_gul', 'Gul fra', 0, '%'), step(K, c, 'input_number.ki_sone_oransje', 'Oransje fra', 0, '%'), step(K, c, 'input_number.ki_sone_rod', 'Rød fra', 0, '%')]) + note('Motoren senker først når den ikke får plass i budsjettet. Fargene styrer varsling og hvor tidlig varmtvannet må vike, ikke selve utkoblingen.') },
      { id: 'prognose', title: 'Prognose og reserver', icon: 'mdi:chart-timeline-variant', help: 'adaptiv', meta: prognoseStatus, body: prognose },
      { id: 'moduser', title: 'Moduser og unntak', icon: 'mdi:tune-variant', body: moduser },
      { id: 'helgevarsler', title: 'Helgevarsler', icon: 'mdi:bag-suitcase', meta: () => 'torsdag, fredag og søndag', body: helgevarsler },
      { id: 'vvb', title: 'Varmtvann, avansert', icon: 'mdi:water-boiler-alert', help: 'vvb_terskel', body: vvbAvansert },
      { id: 'tariff', title: 'Tarifftabell', icon: 'mdi:table', help: 'tariff', meta: () => 'kW → kr/mnd', body: tariff },
      { id: 'entiteter', title: 'Entiteter per sone', icon: 'mdi:link-variant', meta: () => 'rødt = motoren finner den ikke', body: entiteter },
      { id: 'raa', title: 'Motorens råtilstand', icon: 'mdi:code-json', meta: () => 'alt sensoren rapporterer', body: raa },
      { id: 'handlinger', title: 'Handlinger', icon: 'mdi:gesture-tap-button', help: 'handlinger', body: handlinger },
    ],
  };

  /* ================================================================ API: faner og blokker */
  M.KLIMA_TABS = [
    { id: 'oversikt', label: 'Oversikt', icon: 'mdi:view-dashboard' },
    { id: 'soner', label: 'Soner', icon: 'mdi:home-thermometer' },
    { id: 'energi', label: 'Energi', icon: 'mdi:flash' },
    { id: 'vann', label: 'Vann og bad', icon: 'mdi:water-boiler' },
    { id: 'lading', label: 'Lading', icon: 'mdi:ev-plug-type2' },
    { id: 'tanker', label: 'Tanker', icon: 'mdi:head-cog' },
    { id: 'oppsett', label: 'Oppsett', icon: 'mdi:tune' },
    { id: 'avansert', label: 'Avansert', icon: 'mdi:wrench-cog' },
  ];
  // UI-nøkler blokkene lagrer i card.ui (skallet tar dem med i static uiPersist → localStorage ki:<card_id>:ui)
  M.KLIMA_UI_PERSIST = ['klima_collapsed', 'klima_vb', 'klima_gardin'];
  M.klimaCtx = function (card) {
    const K = ctx(card);
    // Modus-listen fra JS-kortets Modus-blokk (skallet tegner den som bobler)
    K.modes = [
      ['input_boolean.ki_helgemodus', K.l('Bortemodus'), 'mdi:bag-suitcase', true],
      ['binary_sensor.ki_alle_borte', K.l('Alle borte'), 'mdi:home-export-outline', false],
      ['input_boolean.ki_hjemkomst_aktiv', K.l('Hjemkomst'), 'mdi:home-import-outline', true],
      ['input_boolean.ki_sommermodus', 'Sommermodus', 'mdi:white-balance-sunny', true],
      ...K.personer.filter((p) => p.type === 'ungdom').map((p) => [`input_boolean.ki_${p.key}_ferie`, `${p.navn} ferie`, 'mdi:school-outline', true]),
    ].map(([id, label, icon, switchable]) => ({ id: mapId(id), label, icon, switchable, exists: !!K.st(id), on: K.pa(id) }));
    K.toggle = (id) => { const s = K.st(id); if (!s) return Promise.resolve(); const d = mapId(id).split('.')[0]; if (d === 'binary_sensor' || d === 'sensor') { M.moreInfo(card, mapId(id)); return Promise.resolve(); } return kall(K.hass, d, s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: id }); };
    return K;
  };
  M.klimaHasTab = function (card, tabId) {
    if (tabId === 'lading') return ctx(card).harLading();
    return !!BLOCKS[tabId];
  };
  M.klimaBlockList = function (card, tabId) {
    return (BLOCKS[tabId] || []).map((b) => ({ id: b.id, title: b.title, icon: b.icon, fixed: !!b.fixed, ...(b.group ? { group: b.group } : {}) }));
  };
  function ordered(tabId, layout) {
    const defs = BLOCKS[tabId] || [];
    const order = (layout && layout.block_order && layout.block_order[tabId]) || [];
    const hidden = new Set((layout && layout.hidden_blocks && layout.hidden_blocks[tabId]) || []);
    const fixed = defs.filter((b) => b.fixed), rest = defs.filter((b) => !b.fixed);
    const ids = rest.map((b) => b.id);
    const ord = order.filter((id) => ids.includes(id));
    ids.forEach((id) => { if (!ord.includes(id)) ord.push(id); });
    return [...fixed, ...ord.map((id) => rest.find((b) => b.id === id))].filter((b) => !hidden.has(b.id));
  }
  function blockHTML(card, K, tabId, b) {
    if (b.show && !b.show(K)) return '';
    const key = `${tabId}:${b.id}`;
    const col = isCollapsed(card, key);
    const helps = [].concat(b.help || []).filter((h) => HJELP[h]);
    const kb = S(card);
    const hOpen = helps.length && kb.help.has('b:' + key);
    let body = '';
    if (!col) {
      try { body = b.body(K, card); } catch (e) { console.error('[ki-msh] klima-blokk', key, e); body = note('Feil i blokken: ' + (e && e.message)); }
      if (body === null || body === undefined) return '';
    }
    let meta = '', mst = null;
    try { meta = b.meta ? b.meta(K) : ''; } catch (e) { meta = ''; }
    // 17.31 (master: true): lukket kort viser «N av M på» / «Alle av» + hovedbryter til høyre for chevronen
    if (col && b.master) { try { mst = b.master(K); } catch (e) { mst = null; } }
    if (mst) meta = mst.total ? (mst.on ? `${mst.on} av ${mst.total} på` : 'Alle av') : '–';
    const mSw = mst ? `<button type="button" class="kb-sw kb-msw${mst.on ? ' on' : ''}${mst.total ? '' : ' miss'}" data-act="k-master" data-k="${esc(key)}" data-haptic="selection" role="switch" aria-checked="${mst.on ? 'true' : 'false'}" aria-label="${esc(b.title)}: alle ${mst.on ? 'av' : 'på'}"${mst.total ? '' : ' disabled'}><i></i></button>` : '';
    const extra = hOpen && b.helpExtra ? b.helpExtra(K) : '';
    return `<section class="kb${col ? ' is-col' : ''}" data-key="kb-${esc(key)}" data-block="${esc(b.id)}">
      <div class="kb-h" data-act="k-coll" data-k="${esc(key)}" role="button" aria-expanded="${col ? 'false' : 'true'}">
        <span class="kb-ic">${M.icon(b.icon, 18)}</span><span class="kb-t">${esc(b.title)}</span>
        ${helps.length ? `<button type="button" class="kb-q${hOpen ? ' on' : ''}" data-act="k-help" data-k="b:${esc(key)}" aria-label="Forklaring">?</button>` : ''}
        <span class="kb-m">${esc(meta || '')}</span><span class="kb-chev">${M.icon('mdi:chevron-down', 20)}</span>${mSw}
      </div>
      ${hOpen ? `<div class="kb-help">${helps.map((h) => esc(HJELP[h])).join('<br><br>')}${extra ? `<div style="margin-top:6px">${esc(extra)}</div>` : ''}</div>` : ''}
      ${col ? '' : `<div class="kb-b">${body}</div>`}
    </section>`;
  }
  M.klimaTabHTML = function (card, tabId, layout) {
    if (!BLOCKS[tabId]) return '';
    const K = ctx(card);
    if (tabId === 'lading' && !K.harLading()) return `<div class="kb-wrap">${blockHTML(card, K, 'lading', BLOCKS.lading[0])}</div>`;
    let pre = '', defs = ordered(tabId, layout);
    if (tabId === 'vann') {
      const harBad = K.har('hanklevarmer');
      let segV = uiGet(card, 'klima_vb', 'bereder');
      if (!harBad) segV = 'bereder';
      if (harBad) pre = seg([['bereder', 'Bereder', 'mdi:water-boiler'], ['bad', 'Bad', 'mdi:shower']], segV, 'k-vb');
      defs = defs.filter((b) => (b.group || 'bereder') === segV);
    }
    if (tabId === 'soner') pre = soneDetalj(K, card);
    const html = defs.map((b) => blockHTML(card, K, tabId, b)).join('');
    return `<div class="kb-wrap" data-ktab="${esc(tabId)}">${pre}${html || note('Alle blokkene i fanen er skjult. Vis dem under Tilpass klima → Blokker.')}</div>`;
  };

  /* ================================================================ API: handlinger */
  function goTab(card, tab) {
    if (typeof card._selectTab === 'function') return card._selectTab(tab);
    if (typeof card.selectTab === 'function') return card.selectTab(tab);
    uiSet(card, { tab });
  }
  // 28.9: Klimas bekreftelser bruker den felles toast-pillen (M.toast) – samme sted, stil og animasjon som overalt
  M.klimaToast = function (card, text) {
    return M.toast(text, { type: /ikke|feil/i.test(String(text)) ? 'error' : 'ok', enabled: !(card && card.config && card.config.toasts === false) });
  };
  const svc = (card, dom, s, data, ok) => kall(card.hass || card._hass, dom, s, data).then(() => { M.haptic('success'); if (ok) M.klimaToast(card, ok); }, () => {});

  M.klimaAct = function (card, name, el, ev) {
    if (!name || name.indexOf('k-') !== 0) return false;
    const kb = S(card), d = el.dataset, K = ctx(card), hass = K.hass;
    switch (name) {
      case 'k-coll': {
        const key = d.k, m = { ...collapsedMap(card) };
        const def = d.def === '1';
        const cur = m[key] !== undefined ? !!m[key] : def;
        m[key] = !cur;
        if (m[key] === def) delete m[key];
        uiSet(card, { klima_collapsed: m });
        return true;
      }
      case 'k-master': {
        // 17.31: alle varsler i kortet på/av i én runde (ett kall per domene), uten å åpne kortet
        if (ev) ev.stopPropagation();
        const [tab, bid] = String(d.k || '').split(':'), b = ((BLOCKS[tab] || []).find((x) => x.id === bid)) || null;
        const m = b && b.master ? b.master(K) : null;
        if (!m || !m.total) return true;
        const on = !m.on, ids = m.ids.map(mapId);
        if (on && m.master) ids.push(mapId(m.master));
        const byDom = {};
        ids.forEach((id) => { const dom = id.split('.')[0]; (byDom[dom] = byDom[dom] || []).push(id); });
        Object.keys(byDom).forEach((dom) => M.call(hass, dom, on ? 'turn_on' : 'turn_off', { entity_id: byDom[dom] }));
        return true;
      }
      case 'k-help': { ev && ev.stopPropagation(); const k = d.k; if (kb.help.has(k)) kb.help.delete(k); else kb.help.add(k); card.update && card.update(); return true; }
      case 'k-tog': {
        const id = d.id;
        const s = K.st(id);
        if (!s) return true;
        if (d.kind === 'bryter') kall(hass, 'switch', s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: id });
        else kall(hass, id.split('.')[0], s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: id });
        return true;
      }
      case 'k-styrer': {
        // «Motoren styrer ovnene» er det motsatte av skyggemodus (JS: veksle input_boolean.ki_skyggemodus)
        const s = K.st('input_boolean.ki_skyggemodus');
        if (!s) return true;
        kall(hass, 'input_boolean', s.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: 'input_boolean.ki_skyggemodus' });
        return true;
      }
      case 'k-more': if (d.id) M.moreInfo(card, mapId(d.id)); return true;
      case 'k-tab': if (d.seg) uiSet(card, { klima_vb: d.seg }); goTab(card, d.tab); return true;
      case 'k-svc': {
        let data = {}; try { data = JSON.parse(d.json || '{}'); } catch (e) { console.error('msh-klima-card', e); }
        M.haptic('light');
        svc(card, d.dom, d.svc, data, d.ok);
        return true;
      }
      case 'k-danger': {
        const k = d.k;
        if (kb.armed && kb.armed.k === k && Date.now() < kb.armed.until) {
          kb.armed = null; clearTimeout(kb.armT);
          let data = {}; try { data = JSON.parse(d.json || '{}'); } catch (e) { console.error('msh-klima-card', e); }
          svc(card, d.dom, d.svc, data, d.ok);
        } else {
          kb.armed = { k, until: Date.now() + 3000 };
          clearTimeout(kb.armT);
          kb.armT = setTimeout(() => { kb.armed = null; card.update && card.update(); }, 3000);
          M.haptic('warning');
        }
        card.update && card.update();
        return true;
      }
      case 'k-step': {
        // Reserve-stepper (når 09-pickers.js mangler)
        const s = hass && hass.states[d.id];
        if (!s) return true;
        const dom = d.id.split('.')[0], dir = Number(d.dir) || 1;
        if (dom === 'time') {
          const m = /^(\d{1,2}):(\d{2})/.exec(s.state); if (!m) return true;
          const t = (((Number(m[1]) * 60 + Number(m[2]) + dir * 15) % 1440) + 1440) % 1440;
          kall(hass, 'time', 'set_value', { entity_id: d.id, time: `${klMin(t)}:00` });
        } else {
          const a = s.attributes || {}, st = Number(a.step) || 1;
          const v = Math.min(Number(a.max ?? 1e9), Math.max(Number(a.min ?? -1e9), Number((Number(s.state) + dir * st).toFixed(4))));
          kall(hass, 'input_number', 'set_value', { entity_id: d.id, value: v });
        }
        return true;
      }
      case 'k-zone': {
        if (d.tab) goTab(card, d.tab);
        kb.zone = kb.zone === d.key ? null : (d.key || null);
        card.update && card.update();
        return true;
      }
      case 'k-zgraf': kb.zgraf[d.key] = d.v; card.update && card.update(); return true;
      case 'k-ov': {
        const l = K.laster().find((x) => x.key === d.key);
        const naa = kb.ov[d.key] !== undefined ? kb.ov[d.key] : Number((l && (l.overstyrt_temp ?? l.mal ?? l.settpunkt)) ?? 21);
        kb.ov[d.key] = Math.round((naa + Number(d.dir) * 0.5) * 2) / 2;
        card.update && card.update();
        return true;
      }
      case 'k-ovset': {
        const l = K.laster().find((x) => x.key === d.key);
        const temp = kb.ov[d.key] !== undefined ? kb.ov[d.key] : Number((l && (l.overstyrt_temp ?? l.mal ?? l.settpunkt)) ?? 21);
        const min = Number(d.min);
        svc(card, 'ki_energi', 'overstyr', { sone: d.key, temp, minutter: min }, `${l ? l.navn : 'Sonen'}: ${nf(temp, 1)}° i ${min >= 60 ? min / 60 + ' t' : min + ' min'}`);
        delete kb.ov[d.key];
        return true;
      }
      case 'k-ovdel': svc(card, 'ki_energi', 'fjern_overstyring', { sone: d.key }, 'Overstyringen er fjernet'); return true;
      case 'k-legg': kall(hass, 'ki_energi', 'leggetid', { sone: d.key, avbryt: d.avbryt === '1' }); return true;
      case 'k-vb': uiSet(card, { klima_vb: d.v }); return true;
      case 'k-gseg': uiSet(card, { klima_gardin: d.v }); return true;
      case 'k-eopen': if (kb.eopen.has(d.key)) kb.eopen.delete(d.key); else kb.eopen.add(d.key); card.update && card.update(); return true;
      case 'k-vvbmodus': {
        const v = d.v;
        const set = (id, on) => { const s = K.st(id); if (s && (s.state === 'on') !== on) kall(hass, 'input_boolean', on ? 'turn_on' : 'turn_off', { entity_id: id }); };
        if (v === 'alltid') set('input_boolean.ki_vvb_alltid_pa', true);
        else { set('input_boolean.ki_vvb_alltid_pa', false); set('input_boolean.ki_vvb_folg_spotpris', v === 'spot'); if (!K.pa('input_boolean.ki_vvb_prisstyring')) set('input_boolean.ki_vvb_prisstyring', true); }
        return true;
      }
      case 'k-lade': {
        // Manuelt trinn: slår av automatikken og trykker knappen for trinnet (knappene kommer fra integrasjonen)
        const amp = Number(d.amp);
        const a = LA(K);
        const knapper = a('knapper', null) || a('ladestrom_knapper', null) || {};
        const eid = knapper[amp] || knapper[String(amp)];
        if (!eid || !hass.states[eid]) { M.haptic('warning'); M.klimaToast(card, 'Knappen er ikke satt opp i integrasjonen'); return true; }
        if (K.pa('input_boolean.ki_lading_automatikk')) kall(hass, 'switch', 'turn_off', { entity_id: 'input_boolean.ki_lading_automatikk' });
        svc(card, 'button', 'press', { entity_id: eid }, `Ladestrøm ${amp} A (manuelt)`);
        return true;
      }
      default: return false;
    }
  };
  M.klimaInput = function (card, name, el, ev, kind) {
    if (!name || name.indexOf('k-') !== 0) return false;
    if (kind !== 'change') return true;
    const hass = card.hass || card._hass, id = el.dataset.id;
    if (!id) return true;
    if (name === 'k-num') { const v = Number(String(el.value).replace(',', '.')); if (isFinite(v)) { M.haptic('selection'); kall(hass, 'input_number', 'set_value', { entity_id: id, value: v }); } }
    else if (name === 'k-time') { if (el.value) { const [t, m] = el.value.split(':'); M.haptic('selection'); kall(hass, 'time', 'set_value', { entity_id: id, time: `${t}:${m}:00` }); } }
    else if (name === 'k-text') { M.haptic('selection'); kall(hass, 'input_text', 'set_value', { entity_id: id, value: el.value }); }
    return true;
  };

  /* ================================================================ API: etter render (grafer, stripe, steppere) */
  function bindScrub(card, el) {
    if (el.__kbScrub) return;
    el.__kbScrub = true;
    M.guardDrag(el, 'none');
    const kb = S(card);
    let on = false;
    const vis = (e) => {
      const labels = kb.graphs[el.dataset.kgraph] || [];
      const bars = el.querySelectorAll('.kb-bar');
      if (!bars.length) return;
      const r = el.getBoundingClientRect();
      const f = Math.max(0, Math.min(0.9999, (e.clientX - r.left) / r.width));
      const i = Math.floor(f * bars.length);
      const br = bars[i].getBoundingClientRect();
      const x = (br.left + br.width / 2 - r.left) / r.width;
      const box = el.querySelector('.kb-scrub'), l = el.querySelector('.kb-scrub-l'), t = el.querySelector('.kb-scrub-t');
      if (!box) return;
      box.hidden = false;
      l.style.left = (x * 100).toFixed(2) + '%';
      t.textContent = labels[i] || '';
      t.style.left = x > 0.6 ? 'auto' : `calc(${(x * 100).toFixed(2)}% + 6px)`;
      t.style.right = x > 0.6 ? `calc(${((1 - x) * 100).toFixed(2)}% + 6px)` : 'auto';
      if (kb.scrubI !== i) { kb.scrubI = i; M.haptic('selection'); }
    };
    el.addEventListener('pointerdown', (e) => { if (e.button) return; on = true; kb.drag = true; card._busy = true; try { el.setPointerCapture(e.pointerId); } catch (x) { console.warn('msh-klima-card', x); } vis(e); });
    el.addEventListener('pointermove', (e) => { if (on || e.pointerType === 'mouse') { if (on) e.preventDefault(); vis(e); } });
    const end = () => {
      const box = el.querySelector('.kb-scrub'); if (box) box.hidden = true;
      if (!on) return;
      on = false; kb.drag = false; card._busy = false; kb.scrubI = null;
      if (kb.dirty) { kb.dirty = false; card.update && card.update(); }
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('pointerleave', end);
  }
  function bindStripe(card, el) {
    if (el.__kbStripe) return;
    el.__kbStripe = true;
    M.guardDrag(el, 'none');
    const kb = S(card);
    let i0 = null, i1 = null;
    const idx = (e) => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(11, Math.floor((e.clientX - r.left) / r.width * 12))); };
    const preview = () => { el.querySelectorAll('.kb-mo').forEach((c, i) => c.classList.toggle('pv', i0 != null && i >= Math.min(i0, i1) && i <= Math.max(i0, i1))); };
    el.addEventListener('pointerdown', (e) => {
      if (e.button || el.classList.contains('dis')) return;
      i0 = i1 = idx(e); kb.drag = true; card._busy = true;
      try { el.setPointerCapture(e.pointerId); } catch (x) { console.warn('msh-klima-card', x); }
      M.haptic('selection'); preview();
    });
    el.addEventListener('pointermove', (e) => { if (i0 == null) return; e.preventDefault(); const i = idx(e); if (i !== i1) { i1 = i; M.haptic('selection'); preview(); } });
    const end = (e) => {
      if (i0 == null) return;
      const a = i0, b = i1;
      i0 = i1 = null; kb.drag = false; card._busy = false;
      if (e.type === 'pointercancel') { preview(); return; }
      const K = ctx(card), fra = el.dataset.fra, til = el.dataset.til;
      if (a === b) {
        const m = a + 1;
        if (kb.mnd && kb.mnd.fraId === fra) {
          kall(K.hass, 'input_number', 'set_value', { entity_id: fra, value: kb.mnd.fra });
          kall(K.hass, 'input_number', 'set_value', { entity_id: til, value: m });
          kb.mnd = null;
          M.haptic('success');
        } else kb.mnd = { fraId: fra, fra: m };
      } else {
        kall(K.hass, 'input_number', 'set_value', { entity_id: fra, value: Math.min(a, b) + 1 });
        kall(K.hass, 'input_number', 'set_value', { entity_id: til, value: Math.max(a, b) + 1 });
        kb.mnd = null;
        M.haptic('success');
      }
      card.update && card.update();
    };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  M.klimaAfterRender = function (card) {
    const root = card.shadowRoot;
    if (!root) return;
    if (M.bindSteppers) M.bindSteppers(root, card);
    root.querySelectorAll('[data-kgraph]').forEach((el) => bindScrub(card, el));
    root.querySelectorAll('[data-kms]').forEach((el) => bindStripe(card, el));
    // Ikke tegn på nytt mens tekstfeltet (tarifftabell) har fokus (_ventTegn i JS-kortet)
    if (!root.__kbFocus) {
      root.__kbFocus = true;
      root.addEventListener('focusin', (e) => { if (e.target && e.target.classList && (e.target.classList.contains('kb-text') || e.target.classList.contains('kb-nat'))) card._pickerFocus = true; });
      root.addEventListener('focusout', (e) => {
        if (!e.target || !e.target.classList || !(e.target.classList.contains('kb-text') || e.target.classList.contains('kb-nat'))) return;
        card._pickerFocus = false;
        setTimeout(() => card.update && card.update(), 250);
      });
    }
  };
  M.klimaOnOpen = function (card) {
    const kb = S(card);
    kb.open = true;
    card.update && card.update(); // tegn på nytt → grafene i åpen fane henter historikk (MSH.history, cache 5 min)
  };
  M.klimaOnClose = function (card) {
    const kb = S(card);
    kb.open = false;
    kb.armed = null; clearTimeout(kb.armT);
    kb.mnd = null;
  };

  /* ================================================================ API: status til heroen */
  const ZONE_TEXT = { ok: 'God margin', yellow: 'Nærmer seg grensen', orange: 'Liten margin', red: 'Fare for ny topp', critical: 'Kritisk', fallback: 'Trygg fallback', off: 'Motoren er av' };
  const ZONE_COLOR = { ok: G, yellow: Y, orange: OR, red: R, critical: 'rgb(240 86 110)', fallback: B, off: 'var(--ki-text-mid, #979797)' };
  M.KLIMA_ZONE_COLOR = ZONE_COLOR;
  const SONE_AV_TILSTAND = { gronn: 'ok', gul: 'yellow', oransje: 'orange', rod: 'red', kritisk: 'critical' };
  M.klimaStatus = function (card) {
    const K = ctx(card);
    const st = K.st('sensor.ki_energi_status');
    const at = (k) => { const v = st && st.attributes ? st.attributes[k] : undefined; return v === null || v === undefined || v === '' ? NaN : Number(v); };
    const kw = at('forventet_effekt_kw'), allowed = at('tillatt_effekt_kw'), usedKwh = at('forbrukt_kwh'), limitKwh = at('grense_kwh'), freeKw = at('ledig_kw'), minLeft = at('minutter_igjen');
    // Prognose ved timeslutt: sensor.ki_estimert_timesforbruk (15.12), ellers prognoselæringen, ellers regnet ut
    let forecastKwh = K.n('sensor.ki_estimert_timesforbruk');
    if (!isFinite(forecastKwh)) forecastKwh = Number(K.a('sensor.ki_prognoselaering', 'forventet_slutt_kwh', NaN));
    if (!isFinite(forecastKwh) && isFinite(usedKwh) && isFinite(kw) && isFinite(minLeft)) forecastKwh = usedKwh + kw * minLeft / 60;
    const pct = isFinite(kw) && isFinite(allowed) && allowed > 0 ? kw / allowed * 100 : NaN;
    const thr = (k, d) => { const v = K.n(`input_number.ki_sone_${k}`); if (isFinite(v)) return v; const w = K.n(`number.ki_terskel_${k}`); return isFinite(w) ? w : d; };
    const tGul = thr('gul', 75), tOr = thr('oransje', 88), tRod = thr('rod', 97);
    const state = st ? st.state : null;
    const motorAv = state === 'av' || (K.st('input_boolean.ki_energi_hovedbryter') && !K.pa('input_boolean.ki_energi_hovedbryter'));
    let zone;
    if (!st) zone = 'off';
    else if (motorAv) zone = 'off';
    else if (state === 'fallback') zone = 'fallback';
    // Tilstanden ER sonen motoren har regnet ut (engine.py: gronn/gul/oransje/rod/kritisk) – den går foran egen utregning
    else if (SONE_AV_TILSTAND[state]) zone = SONE_AV_TILSTAND[state];
    else if (pct > 100 || (isFinite(usedKwh) && isFinite(limitKwh) && usedKwh > limitKwh)) zone = 'critical';
    else if (isFinite(pct)) zone = pct >= tRod ? 'red' : pct >= tOr ? 'orange' : pct >= tGul ? 'yellow' : 'ok';
    else zone = 'fallback';
    const soner = soneListe(K);
    const senket = soner.filter((l) => l.handling === 'senket').map((l) => l.navn);
    const kandidat = [...soner].reverse().find((l) => l.handling !== 'senket' && !l.overstyrt && l.handling !== 'manuell');
    const nextZone = kandidat ? kandidat.navn : '';
    const f2 = (v) => nf(v, 2);
    let sentence = '', sentenceHtml = '';
    switch (zone) {
      case 'ok': sentenceHtml = `Du kan slå på <b>${f2(freeKw)} kW</b> til uten å passere ${f2(limitKwh)} kWh.`; break;
      case 'yellow': sentenceHtml = `Du har <b>${f2(freeKw)} kW</b> å gå på. Vent med store apparater.`; break;
      case 'orange': sentenceHtml = `Unngå å slå på mer. Motoren senker ${esc(nextZone || 'en sone')} snart.`; break;
      case 'red': sentenceHtml = `Motoren senker ${esc(senket.length ? senket.join(', ') : nextZone || 'soner')} nå for å holde timen.`; break;
      case 'critical': sentenceHtml = 'Timen går over grensen. Slå av det du kan.'; break;
      case 'fallback': sentenceHtml = 'Styrer etter fast reserve til måleren svarer igjen.'; break;
      default: sentenceHtml = st ? 'Ingenting styres. Slå på under Oppsett → Motor.' : '';
    }
    sentence = sentenceHtml.replace(/<[^>]+>/g, '');
    return {
      kw: isFinite(kw) ? kw : null, allowed: isFinite(allowed) ? allowed : null, usedKwh: isFinite(usedKwh) ? usedKwh : null, limitKwh: isFinite(limitKwh) ? limitKwh : null,
      forecastKwh: isFinite(forecastKwh) ? forecastKwh : null, freeKw: isFinite(freeKw) ? freeKw : null, minLeft: isFinite(minLeft) ? minLeft : null, pct: isFinite(pct) ? pct : null,
      zone, color: ZONE_COLOR[zone], text: st ? ZONE_TEXT[zone] : '–', sentence, sentenceHtml, nextZone, senket,
      state, explanation: st ? K.a('sensor.ki_energi_status', 'forklaring', '') : '', thresholds: { gul: tGul, oransje: tOr, rod: tRod },
    };
  };

  /* ================================================================ CSS */
  const CSS = `
    .kb-wrap{display:flex;flex-direction:column;gap:var(--msh-gap,8px);min-width:0}
    .kb{display:flex;flex-direction:column;gap:12px;padding:16px;border-radius:28px;background:var(--ki-surface, var(--gray200,#3a3a3a));min-width:0}
    .kb.is-col{gap:0}
    .kb-h{display:flex;align-items:center;gap:8px;min-height:28px;cursor:pointer;user-select:none;-webkit-user-select:none}
    .kb-ic{display:inline-flex;color:var(--ki-text-mid, var(--gray700,#979797));flex:none}
    .kb-t{font-size:15px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 0 auto;max-width:72%;min-width:0}
    .kb-m{flex:1 1 auto;min-width:0;text-align:right;font-size:12px;color:var(--ki-text-mid, var(--gray600,#7f7f7f));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .kb-chev{display:inline-flex;color:var(--ki-text-mid, var(--gray600,#7f7f7f));transition:transform .2s;flex:none}
    .kb.is-col .kb-chev,.kb-subsec.is-col .kb-subh ha-icon{transform:rotate(-90deg)}
    .kb-q{width:28px;height:28px;border-radius:14px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));color:var(--ki-text-2, var(--gray800,#afafaf));font-size:13px;font-weight:600;display:inline-grid;place-items:center;flex:none;transition:background .15s,color .15s}
    .kb-q.sm{width:20px;height:20px;border-radius:10px;font-size:11px;margin-left:2px}
    .kb-q.on{background:rgba(242,133,201,.22);color:var(--ki-pink-text, rgb(242 133 201))}
    .kb-help{background:var(--ki-surface-3, var(--gray100,#2f2f2f));border-radius:16px;padding:12px 14px;font-size:12px;line-height:1.5;color:var(--ki-text-1, var(--gray900,#c7c7c7));text-wrap:pretty}
    .kb-b{display:flex;flex-direction:column;gap:12px;min-width:0}
    .kb-list{display:flex;flex-direction:column;min-width:0}
    .kb-list>.kb-row+.kb-row,.kb-list>.kb-help+.kb-row,.kb-list>.kb-eg+.kb-eg{border-top:1px solid rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.05*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .kb-list>.kb-help{margin:0 0 8px}
    .kb-row{display:flex;align-items:center;gap:10px;padding:10px 0;min-height:44px;min-width:0}
    .kb-row.tap{cursor:pointer}
    .kb-row.tap:active{opacity:.75}
    .kb-srow{padding:6px 0}
    .kb-dot{width:7px;height:7px;border-radius:4px;flex:none}
    .kb-rt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .kb-rn{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px;font-weight:500;min-width:0;overflow-wrap:anywhere}
    .kb-rs{font-size:11px;color:var(--ki-text-mid, var(--gray600,#7f7f7f));line-height:1.4;text-wrap:pretty;overflow-wrap:anywhere}
    .kb-rv{font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;flex:none;text-align:right;max-width:48%;overflow:hidden;text-overflow:ellipsis}
    .kb-rv.pill{padding:6px 11px;border-radius:12px;background:var(--ki-surface-3, var(--gray100,#2f2f2f))}
    .kb-chip{font-size:10px;font-weight:600;padding:2px 7px;border-radius:7px;white-space:nowrap}
    .kb-sw{position:relative;width:44px;height:26px;border-radius:13px;flex:none;background:var(--ki-surface-2, var(--gray300,#404040));transition:background .2s}
    .kb-sw i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:10px;background:var(--ki-knob, #fafafa);transition:left .2s}
    .kb-sw.on{background:rgb(242 133 201)}
    .kb-sw.on i{left:21px}
    .kb-sw.miss{opacity:.35}
    .kb-msw{margin-left:2px;cursor:pointer}
    .kb-stats{display:grid;gap:6px}
    .kb-stat{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:12px 4px;border-radius:18px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));text-align:center;min-width:0}
    .kb-stat b{font-size:17px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
    .kb-stat span{font-size:10px;color:var(--ki-text-mid, var(--gray600,#7f7f7f));line-height:1.3}
    .kb-big{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
    .kb-big b{font-size:40px;font-weight:300;letter-spacing:-.04em;font-variant-numeric:tabular-nums;line-height:1}
    .kb-big span{font-size:14px;color:var(--ki-text-mid, var(--gray600,#7f7f7f))}
    .kb-concl{font-size:13px;line-height:1.45;color:var(--ki-text-1, var(--gray900,#c7c7c7));text-wrap:pretty}
    .kb-note{font-size:11px;line-height:1.5;color:var(--ki-text-mid, var(--gray600,#7f7f7f));text-wrap:pretty}
    .kb-warn{display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-radius:14px;background:rgba(242,128,115,.14);color:var(--ki-red-text, rgb(242 128 115));font-size:12px;line-height:1.4}
    .kb-sub{font-size:12px;font-weight:600;color:var(--ki-text-mid, var(--gray700,#979797));padding-top:2px}
    .kb-facts{display:flex;flex-wrap:wrap;gap:6px}
    .kb-fact{font-size:11px;padding:4px 9px;border-radius:9px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));color:var(--ki-text-2, var(--gray800,#afafaf))}
    .kb-facts .kb-chip{font-size:11px;padding:4px 9px;border-radius:9px}
    .kb-ul{margin:0;padding-left:18px;font-size:12px;line-height:1.5;color:var(--ki-text-1, var(--gray900,#c7c7c7))}
    .kb-ul.sm{font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797))}
    .kb-dim{opacity:.4;pointer-events:none}
    .kb-wait{font-size:12px;color:var(--ki-text-mid, var(--gray600,#7f7f7f));padding:18px 0;text-align:center}
    .kb-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .kb-btn{display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:8px 12px;border-radius:22px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));font-size:13px;font-weight:500;text-align:center;transition:transform .15s cubic-bezier(.34,1.5,.64,1),background .2s,color .2s}
    .kb-btn:active{transform:scale(.96)}
    .kb-btn.wide{width:100%}
    .kb-btn.on{background:rgba(242,133,201,.22);color:var(--ki-pink-text, rgb(242 133 201))}
    .kb-btn.armed{background:rgb(242 128 115);color:#2a1512}
    .kb-seg{display:flex;gap:2px;padding:4px;border-radius:22px;background:var(--ki-surface-3, var(--gray100,#2f2f2f))}
    .kb-seg button{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 8px;border-radius:18px;font-size:13px;font-weight:500;color:var(--ki-text-mid, var(--gray700,#979797));white-space:nowrap;transition:background .2s,color .2s}
    .kb-seg button span{overflow:hidden;text-overflow:ellipsis}
    .kb-seg button.on{background:var(--ki-surface-2, var(--gray300,#404040));color:var(--ki-text, #fafafa)}
    .kb-seg button:disabled{opacity:.35}
    .kb-wrap>.kb-seg{background:var(--ki-surface, var(--gray200,#3a3a3a));border-radius:26px}
    .kb-wrap>.kb-seg button{height:44px;border-radius:22px;font-size:14px}
    .kb-subsec{border-radius:18px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));padding:0 12px}
    .kb-subh{display:flex;align-items:center;gap:8px;min-height:44px;font-size:13px;font-weight:500;cursor:pointer}
    .kb-subh>span:first-child{flex:1}
    .kb-subm{font-size:11px;color:var(--ki-text-mid, var(--gray600,#7f7f7f));font-weight:400}
    .kb-subb{padding-bottom:6px}
    .kb-subsec+.kb-subsec{margin-top:6px}
    .kb-track{position:relative;height:10px;border-radius:5px;background:var(--ki-surface-3, var(--gray100,#2f2f2f))}
    .kb-track.sm{height:6px}
    .kb-track.lg{height:22px;border-radius:11px}
    .kb-track>i{position:absolute;left:0;top:0;bottom:0;border-radius:inherit;transition:width .4s}
    .kb-track>b{position:absolute;top:-3px;bottom:-3px;width:2px;border-radius:1px;background:rgb(var(--ki-wa-c,255 255 255)/0.55)}
    .kb-tracktxt{display:flex;justify-content:space-between;font-size:11px;color:var(--ki-text-mid, var(--gray600,#7f7f7f));margin-top:-4px}
    .kb-legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:10px;color:var(--ki-text-mid, var(--gray600,#7f7f7f))}
    .kb-legend span{display:inline-flex;align-items:center;gap:5px}
    .kb-legend i{width:8px;height:8px;border-radius:2px;display:inline-block}
    .kb-live i{border-radius:4px;background:rgb(102 209 158);animation:kbpuls 2s ease-in-out infinite}
    @keyframes kbpuls{50%{opacity:.35}}
    .kb-bars{position:relative;display:flex;align-items:flex-end;touch-action:none;cursor:crosshair;user-select:none;-webkit-user-select:none}
    .kb-bar{position:relative;flex:1;min-width:0;height:100%;display:flex;flex-direction:column-reverse;border-radius:4px}
    .kb-bar i{display:block;width:100%;border-radius:3px;min-height:0;flex:none}
    .kb-bars.stack .kb-bar i+i{border-radius:3px 3px 0 0}
    .kb-bars.stack .kb-bar i:first-child{border-radius:0 0 3px 3px}
    .kb-bars.dense .kb-bar{border-radius:2px}
    .kb-bdot{position:absolute;top:-5px;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:2px;background:rgb(242 181 115)}
    .kb-gl{position:absolute;left:0;right:0;border-top:1px dashed;pointer-events:none;z-index:1}
    .kb-gl em{position:absolute;right:0;bottom:1px;font-size:9px;font-style:normal;background:var(--ki-surface, var(--gray200,#3a3a3a));padding:0 3px;border-radius:3px}
    .kb-axis{display:flex;justify-content:space-between;gap:2px;font-size:9px;color:var(--ki-text-lo, var(--gray500,#696969));font-variant-numeric:tabular-nums;margin-top:-6px}
    .kb-bars+.kb-axis span{flex:1;text-align:center;min-width:0;overflow:visible;white-space:nowrap}
    .kb-scrub{position:absolute;inset:0;pointer-events:none;z-index:2}
    .kb-scrub[hidden]{display:none}
    .kb-scrub-l{position:absolute;top:-4px;bottom:0;width:0;border-left:1.5px dashed var(--ki-text, #fafafa)}
    .kb-scrub-t{position:absolute;top:-6px;padding:4px 8px;border-radius:8px;background:rgba(20,20,22,.9);font-size:11px;font-weight:500;white-space:nowrap;font-variant-numeric:tabular-nums}
    .kb-fc{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
    .kb-fc .kb-stat{gap:6px;padding:10px 4px}
    .kb-fc .kb-stat b{font-size:14px}
    .kb-fcb{position:relative;width:8px;height:44px;border-radius:4px;background:var(--ki-surface-2, var(--gray300,#404040));overflow:hidden;display:flex;align-items:flex-end}
    .kb-fcb i{display:block;width:100%;border-radius:4px}
    .kb-bed{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .kb-bedb{display:flex;align-items:center;gap:10px;padding:10px;border-radius:22px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));text-align:left;min-width:0;transition:transform .15s}
    .kb-bedb:active{transform:scale(.97)}
    .kb-bedb.on{background:${PINK};color:#2a1720}
    .kb-bedi{width:36px;height:36px;border-radius:18px;display:grid;place-items:center;background:var(--ki-surface-2, var(--gray300,#404040));flex:none}
    .kb-bedb.on .kb-bedi{background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.4*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .kb-bedt{display:flex;flex-direction:column;min-width:0}
    .kb-bedt b{font-size:14px;font-weight:500}
    .kb-bedt span{font-size:11px;opacity:.7}
    .kb-dp{display:flex;flex-direction:column;gap:6px;padding-top:4px}
    .kb-dp-r{display:flex;align-items:center;gap:8px}
    .kb-dp-n{width:72px;flex:none;font-size:11px;color:var(--ki-text-2, var(--gray800,#afafaf));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .kb-dp-t{position:relative;flex:1;height:22px;border-radius:8px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));overflow:hidden;min-width:0}
    .kb-dp-sp{position:absolute;top:2px;bottom:2px;border-radius:6px;color:var(--ki-text, #fafafa);font-size:9px;font-weight:600;display:flex;align-items:center;padding-left:5px;overflow:hidden;white-space:nowrap}
    .kb-dp-mk{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;border-radius:1px}
    .kb-dp-ml{position:absolute;top:0;bottom:0;display:flex;align-items:center;padding:0 4px;font-size:9px;font-weight:600;color:var(--ki-text-1, var(--gray900,#c7c7c7));white-space:nowrap}
    .kb-dp-now{position:absolute;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--ki-text, #fafafa)}
    .kb-dp-ax{display:flex;justify-content:space-between;padding-left:80px;font-size:9px;color:var(--ki-text-lo, var(--gray500,#696969));font-variant-numeric:tabular-nums}
    .kb-ms{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:4px;touch-action:none;user-select:none;-webkit-user-select:none;cursor:pointer}
    .kb-ms.dis{opacity:.4;pointer-events:none}
    .kb-mo{height:34px;border-radius:10px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));display:grid;place-items:center;font-size:10px;font-weight:500;color:var(--ki-text-2, var(--gray800,#afafaf));min-width:0;overflow:hidden;transition:background .15s}
    .kb-mo.in{background:rgba(242,133,201,.28);color:var(--ki-text, #fafafa)}
    .kb-mo.start{background:${PINK};color:#2a1720}
    .kb-mo.now{box-shadow:inset 0 0 0 1.5px var(--ki-text, #fafafa)}
    .kb-mo.pv{background:rgba(242,133,201,.55);color:var(--ki-text, #fafafa)}
    .kb-zgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .kb-zt{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding:12px;border-radius:22px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));text-align:left;min-width:0;transition:transform .15s}
    .kb-zt:active{transform:scale(.97)}
    .kb-zt.on{box-shadow:inset 0 0 0 1.5px rgb(242 133 201)}
    .kb-zt-top{display:flex;justify-content:space-between;align-items:center;width:100%;gap:6px}
    .kb-zt-i{width:34px;height:34px;border-radius:17px;display:grid;place-items:center;flex:none}
    .kb-zt-i.lg{width:44px;height:44px;border-radius:22px}
    .kb-zt-temp{font-size:26px;font-weight:300;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
    .kb-zt-n{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%}
    .kb-zt-s{font-size:11px;color:var(--ki-text-mid, var(--gray600,#7f7f7f));display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .kb-zone{box-shadow:inset 0 0 0 1px rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.06*var(--ki-wa-k,1)),var(--ki-wa-max,1)))}
    .kb-zh{display:flex;align-items:center;gap:12px}
    .kb-zh-t{flex:1;min-width:0;display:flex;flex-direction:column}
    .kb-zh-t b{font-size:16px;font-weight:600}
    .kb-zh-t span{font-size:12px;color:var(--ki-text-mid, var(--gray600,#7f7f7f));text-wrap:pretty}
    .kb-x{width:36px;height:36px;border-radius:18px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));display:grid;place-items:center;flex:none}
    .kb-ovbox{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px;border-radius:30px;background:var(--ki-surface-3, var(--gray100,#2f2f2f))}
    .kb-ovb{width:48px;height:48px;border-radius:24px;background:var(--ki-surface-2, var(--gray300,#404040));display:grid;place-items:center;transition:transform .12s}
    .kb-ovb:active{transform:scale(.92)}
    .kb-ovv{display:flex;flex-direction:column;align-items:center}
    .kb-ovv b{font-size:30px;font-weight:300;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
    .kb-ovv span{font-size:11px;color:var(--ki-text-mid, var(--gray600,#7f7f7f))}
    .kb-durs{display:flex;gap:6px}
    .kb-dur{flex:1;height:40px;border-radius:20px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));font-size:13px;font-weight:500;transition:transform .15s}
    .kb-dur:active{transform:scale(.95);background:rgba(242,133,201,.3)}
    .kb-zg{display:flex;gap:10px;align-items:stretch}
    .kb-zg .kb-bars{flex:1;min-width:0}
    .kb-zmm{display:flex;flex-direction:column;justify-content:space-between;font-size:10px;color:var(--ki-text-mid, var(--gray600,#7f7f7f));text-align:right;flex:none;min-width:44px}
    .kb-zmm span{display:flex;flex-direction:column}
    .kb-zmm b{font-size:12px;color:var(--ki-text, #fafafa);font-weight:600;font-variant-numeric:tabular-nums}
    .kb-spar{display:flex;flex-direction:column;gap:10px}
    .kb-sp{display:flex;flex-direction:column;gap:5px}
    .kb-sp-h{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px}
    .kb-sp-h span{display:flex;align-items:center;gap:8px}
    .kb-sp-h b{font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
    .kb-sp-h small{font-weight:400;color:var(--ki-text-mid, var(--gray600,#7f7f7f));font-size:11px}
    .kb-sp-bar{position:relative;height:8px;border-radius:4px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));overflow:hidden}
    .kb-sp-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:rgb(102 209 158);z-index:1}
    .kb-sp-bar em{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:rgba(102,209,158,.25)}
    .kb-lg{display:flex;align-items:center;gap:16px}
    .kb-legring{position:relative;width:96px;height:96px;border-radius:50%;flex:none}
    .kb-legring>div{position:absolute;inset:10px;border-radius:50%;background:var(--ki-surface, var(--gray200,#3a3a3a));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
    .kb-legring span{font-size:10px;color:var(--ki-text-mid, var(--gray600,#7f7f7f))}
    .kb-lg-t,.kb-ev-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
    .kb-lg-t b{font-size:16px;font-weight:600}
    .kb-lg-t>span:last-child,.kb-ev-t>span:last-child{font-size:12px;color:var(--ki-text-mid, var(--gray600,#7f7f7f));text-wrap:pretty}
    .kb-cap{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
    .kb-ev{display:flex;align-items:center;gap:14px}
    .kb-ev-i{width:56px;height:56px;border-radius:28px;display:grid;place-items:center;flex:none}
    .kb-ev-t b{font-size:30px;font-weight:300;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1.1}
    .kb-ev-t b small{font-size:13px;color:var(--ki-text-mid, var(--gray600,#7f7f7f));letter-spacing:0}
    .kb-ledig{display:flex;flex-direction:column;gap:10px}
    .kb-amps{display:grid;grid-template-columns:repeat(auto-fit,minmax(56px,1fr));gap:6px}
    .kb-amp{display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 4px;border-radius:18px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));transition:transform .15s,opacity .2s}
    .kb-amp:active{transform:scale(.95)}
    .kb-amp b{font-size:15px;font-weight:600}
    .kb-amp span{font-size:10px;color:var(--ki-text-mid, var(--gray600,#7f7f7f))}
    .kb-amp.on{background:${PINK};color:#2a1720}
    .kb-amp.on span{color:rgba(42,23,32,.7)}
    .kb-amp.dim{opacity:.4}
    .kb-tl{display:flex;flex-direction:column}
    .kb-tl-i{display:flex;gap:12px}
    .kb-tl-d{display:flex;flex-direction:column;align-items:center;width:12px;flex:none;padding-top:4px}
    .kb-tl-d i{width:10px;height:10px;border-radius:5px;flex:none}
    .kb-tl-d em{flex:1;width:2px;background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.08*var(--ki-wa-k,1)),var(--ki-wa-max,1)));margin-top:4px}
    .kb-tl-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;padding-bottom:14px}
    .kb-tl-h{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
    .kb-tl-t{font-size:12px;color:var(--ki-text-mid, var(--gray600,#7f7f7f));font-variant-numeric:tabular-nums}
    .kb-tl-h b{font-size:13px;font-weight:500}
    .kb-tl-v{margin-left:auto;font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797));font-variant-numeric:tabular-nums}
    .kb-inrow{display:flex}
    .kb-text{flex:1;min-width:0;height:44px;padding:0 14px;border-radius:14px;background:var(--ki-surface-3, var(--gray100,#2f2f2f));color:var(--ki-text, #fafafa);font-size:16px;color-scheme:dark}
    .kb-tariff{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px}
    .kb-tariff>div{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:14px;background:var(--ki-surface-3, var(--gray100,#2f2f2f))}
    .kb-tariff span{font-size:11px;color:var(--ki-text-mid, var(--gray600,#7f7f7f))}
    .kb-tariff b{font-size:14px;font-weight:600}
    .kb-tariff em{font-size:10px;font-style:normal;color:color-mix(in srgb, var(--ki-green-text, rgb(102 209 158)) calc(100% - (var(--ki-tone-k, 1) - 1) * 50%), black)}
    .kb-tariff>div.on{box-shadow:inset 0 0 0 1.5px rgb(102 209 158)}
    .kb-raw{display:flex;flex-direction:column;gap:6px;max-height:420px;overflow:auto;overscroll-behavior:contain}
    .kb-raw>div{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border-radius:12px;background:var(--ki-surface-3, var(--gray100,#2f2f2f))}
    .kb-raw span{font-size:11px;color:var(--ki-text-mid, var(--gray700,#979797))}
    .kb-raw code{font:500 11px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ki-text-1, var(--gray900,#c7c7c7));overflow-wrap:anywhere;white-space:pre-wrap}
    .kb-eg.open{background:rgb(var(--ki-wa-c,255 255 255)/clamp(var(--ki-wa-min,0),calc(0.02*var(--ki-wa-k,1)),var(--ki-wa-max,1)));border-radius:12px}
    .kb-err .kb-rn{color:var(--ki-red-text, rgb(242 128 115))}
    .kb-stp{display:inline-flex;align-items:center;gap:6px;flex:none}
    .kb-stb{width:32px;height:32px;border-radius:16px;background:var(--ki-step-bg, var(--gray100,#2f2f2f));box-shadow:var(--ki-step-sh, none);color:var(--ki-text, #fafafa);display:grid;place-items:center}
    .kb-stb:disabled{opacity:.35}
    .kb-stv{position:relative;min-width:56px;height:32px;display:grid;place-items:center;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}
    .kb-stp.dis .kb-stv{color:var(--ki-text-mid, var(--gray700,#979797))}
    .kb-nat{position:absolute;inset:0;width:100%;height:100%;opacity:0;font-size:16px;color-scheme:dark}
  `;
  Object.defineProperty(M, 'KLIMA_BLOCK_CSS', { configurable: true, get() { return CSS + (M.STEPPER_CSS || ''); } });
})();
