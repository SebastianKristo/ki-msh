/* KI MSH · varslingskilden (fiks 29.1) – bryterne fra KI Varslinger og sikkerhet + KI Energi, funnet i entitetsregisteret.
 *
 * Datalogikken er flyttet UENDRET fra brukerens kort ki-cards/src/83-ki-varsling-card.js (KiVarslingCard._brytere,
 * KI_VARS_TEKST, KI_VARS_IKON, erMaster, KiVarslingEditor._plattformer) og er den eneste kopien i ki-msh:
 * msh-innstillinger-card (60-innstillinger.js) bruker bare denne modulen. ki-cards selv endres ikke (brukerens valg);
 * test/innstillinger29-check.mjs laster ki-varsling-card ved siden av og sjekker at resultatet er identisk.
 *
 *   MSH.finnBrytere(hass, cfg) → [{ id, slug, kilde, plattform, enhet, navn, under, ikon, pa, borte }]
 *     cfg = én ki-varsling-card-config: plattform, ekstra, master, ikke_master, kjente, enheter, ikke_enheter, bare,
 *     skjul, navn, undertekst, ikoner, skille. Kilde = hass.entities/hass.devices (plattformen står bare der).
 *   MSH.varslingPlattformer(hass) → [{ value, label, n, varsler }] – alle plattformer med switch/input_boolean, flest først
 *   MSH.varslingSig(liste) → signatur av [id, pa] (tegn bare på endring)
 *   MSH.KI_VARS_TEKST · MSH.KI_VARS_IKON · MSH.kiVarsIkon · MSH.kiVarsErMaster · MSH.KI_VARS_PLATTFORM
 */
(function () {
  const M = window.MSH;
  if (!M) return;

  /* Flere integrasjoner kan ha varslingsbrytere. `ki_energi` legger alle sine på ÉN
     enhet, i motsetning til `ki_notifications` som har én enhet per regel. */
  const KI_VARS_PLATTFORM = ['ki_notifications', 'ki_energi'];

  /* Navn og beskrivelse per regel, slik de sto i det håndskrevne oppsettet.
     Integrasjonens egne navn er tekniske («Alarm - Alle varsler»), og disse er de som
     faktisk forklarer hva bryteren gjør. `navn:` og `undertekst:` overstyrer. */
  const KI_VARS_TEKST = [
    [/vekking|vekke/, 'Vekking', 'Lys og lyd på vekketidspunkt', 'mdi:alarm'],
    [/ansikt/, 'Ansiktsgjenkjenning', 'Låser opp ved gjenkjent ansikt', 'mdi:face-recognition'],
    [/autolas|autolås/, 'Autolås', 'Låser døra automatisk etter lukking', 'mdi:lock-clock'],
    [/fastkjort|fastkjørt/, 'Fastkjørt lås', 'Varsel hvis låsen ikke går i lås', 'mdi:lock-alert'],
    [/blink|dorlys|dørlys/, 'Dørlys', 'Blinker med lyset når døra åpnes', 'mdi:monitor-shimmer'],
    [/familie|hjemme.?borte/, 'Hjemme / borte', 'Varsler når noen kommer eller drar', 'mdi:home-account'],
    [/^alarm|alarm_/, 'Alarm', 'Aktiverer alarmsystemet', 'mdi:shield-home'],
    [/heimdall|alarmo/, 'Heimdall', 'Synk mellom Heimdall og Alarmo', 'mdi:sync'],
    [/ruter|skolen/, 'Ruter fra skolen', 'Avgangstider hjem etter forelesning', 'mdi:bus-clock'],
    [/planter/, 'Planter', 'Varsel når plantene trenger vann', 'mdi:flower-tulip'],
    [/stovsug|støvsug/, 'Støvsuger', 'Varsel om feil og fullført runde', 'mdi:robot-vacuum'],
    [/home.?assistant|oppstart|startet/, 'Home Assistant', 'Varsel etter omstart av HA', 'mdi:home-assistant'],
    [/vaermelding|værmelding|vaer_ai/, 'Værmelding', 'Daglig værvarsel fra AI', 'mdi:weather-partly-cloudy'],
    [/stromforbruk|strømforbruk|forbruk.?rapport/, 'Strømforbruk', 'Daglig rapport', 'mdi:chart-bar'],

    /* KI Utelys. Tre brytere på samme enhet, som ellers ville hett det samme. */
    [/ki_utelys_auto/, 'Utelys automatikk', 'Styrer utelysene etter solhøyden', 'mdi:lightbulb-auto'],
    [/ki_utelys_morgen/, 'Utelys morgen', 'Lys om morgenen til det lysner', 'mdi:weather-sunset-up'],
    [/ki_utelys_kveld/, 'Utelys kveld', 'Lys om kvelden når det blir mørkt', 'mdi:weather-sunset-down'],

    /* KI Energi. Hovedbryteren først: den slår av alle de andre, og må ikke forveksles
       med `ki_varsel_effekt`, som bare gjelder effektgrensen. */
    [/\bki_energi_varsler\b/, 'Energivarsler', 'Hovedbryter for alle energivarsler', 'mdi:bell-outline'],
    [/ki_varsel_effekt/, 'Effektgrense', 'Varsel når timen nærmer seg grensen', 'mdi:flash-alert'],
    [/ki_varsel_hjemkomst/, 'Hjemkomst', 'Varsel når huset varmes opp før dere kommer', 'mdi:home-import-outline'],
    [/ki_varsel_sommer/, 'Sommermodus', 'Varsel når sommermodus slår inn', 'mdi:white-balance-sunny'],
    [/ki_varsel_vvb/, 'Varmtvann', 'Varsel om berederen og legionella', 'mdi:water-boiler'],
    [/ki_varsel_hanklevarmer/, 'Håndklevarmer', 'Varsel om håndklevarmeren', 'mdi:radiator'],
    [/ki_varsel_helg/, 'Bortemodus', 'Varsel når huset settes i bortemodus', 'mdi:bag-suitcase'],
    [/ki_helg_spor_torsdag/, 'Spør torsdag', 'Spør om dere drar bort i helgen', 'mdi:calendar-question'],
    [/ki_helg_spor_fredag/, 'Spør fredag', 'Spør igjen fredag hvis du ikke svarte', 'mdi:calendar-question'],
  ];

  /* Ikon gjettes fra navnet når integrasjonen ikke gir et. Rekkefølgen betyr noe:
     «dorlas_fastkjort» skal treffe låsen, ikke varselet, så de mest spesifikke først. */
  const KI_VARS_IKON = [
    [/fastkjort|fastkj/, 'mdi:lock-alert'],
    [/autolas|autolås/, 'mdi:lock-clock'],
    [/las|lås|dor|dør/, 'mdi:door-closed-lock'],
    [/alarm|heimdall|alarmo/, 'mdi:shield-home'],
    [/ansikt|face/, 'mdi:face-recognition'],
    [/familie|hjemme|borte|person/, 'mdi:home-account'],
    [/stovsug|støvsug|vacuum/, 'mdi:robot-vacuum'],
    [/vaer|vær|weather/, 'mdi:weather-partly-cloudy'],
    [/ruter|buss|avgang/, 'mdi:bus-clock'],
    [/strom|strøm|forbruk|energi/, 'mdi:chart-bar'],
    [/oppstart|restart|startup/, 'mdi:restart'],
    [/blink|lys|skjerm/, 'mdi:monitor-shimmer'],
    [/rapport|daglig/, 'mdi:file-document-outline'],
  ];

  const kiVarsIkon = (tekst) => {
    const t = String(tekst || '').toLowerCase();
    for (const [m, ikon] of KI_VARS_IKON) if (m.test(t)) return ikon;
    return 'mdi:bell-outline';
  };

  /* Hovedbryteren kjennes på navnet: «alle varsler», «aktivert», «varsling», eller
     at den heter det samme som regelen. */
  const erMaster = (b) => /alle[ _-]?varsler|_aktivert$|_varsling$|_aktiv$|_auto$|_automatikk$/.test(b.id)
    || b.slug === b.enhet.toLowerCase().replace(/[^a-z0-9]+/g, '_')
    || /^(alle varsler|aktivert|varsling|aktiv)$/i.test(b.under || '');

  /* Bryterne fra integrasjonen, pluss det som er lagt til manuelt i `ekstra`.
   *
   * Vi går gjennom entitetsregisteret og ikke gjennom tilstandene, fordi registeret er
   * det eneste stedet plattformen står. To brytere kan hete det samme og komme fra
   * ulike integrasjoner.
   *
   * = KiVarslingCard._brytere() (setConfig: plattform-standard, this._plattformer = [].concat(c.plattform)). */
  function finnBrytere(h, cfg) {
    if (!h) return [];
    const c = { plattform: KI_VARS_PLATTFORM, ...(cfg || {}) };
    const plattformer = [].concat(c.plattform);
    const reg = h.entities || {};
    const dev = h.devices || {};
    const skjul = new Set((c.skjul || []).map(String));
    const ut = [];

    const legg = (id, kilde) => {
      const st = h.states[id];
      if (!st) return;
      const slug = id.split('.')[1] || id;
      if (skjul.has(slug) || skjul.has(id)) return;
      const e = reg[id] || {};
      const enhet = (dev[e.device_id] || {}).name_by_user
        || (dev[e.device_id] || {}).name || '';
      const a = st.attributes || {};
      const eget = (c.navn || {})[slug] || (c.navn || {})[id];
      const egenUnder = (c.undertekst || {})[slug] || (c.undertekst || {})[id];

      /* Navn og undertekst hentes som i template_toggle_card_small: `friendly_name`
         deles på et skilletegn, navnet foran og beskrivelsen bak.
         «Vekking - Lys og lyd på vekketidspunkt» blir to linjer. */
      const skille = c.skille || '-';
      const helt = a.friendly_name || slug;
      const deler = helt.split(skille);
      let navn = deler[0].trim() || slug;
      let under = deler.length > 1 ? deler.slice(1).join(skille).trim() : '';

      /* Uten skilletegn i navnet faller vi tilbake til enhetsnavnet som overskrift og
         resten som beskrivelse — «Autolås Autolås» skal ikke stå to ganger. */
      if (!under && enhet && helt.toLowerCase().startsWith(enhet.toLowerCase() + ' ')) {
        navn = enhet;
        under = helt.slice(enhet.length + 1).trim();
      }
      /* Kjente regler får navnet og forklaringen fra tabellen over. */
      let kjentIkon = null;
      if (c.kjente !== false) {
        const n = `${slug} ${enhet} ${helt}`.toLowerCase();
        for (const [m, kn, ku, ki] of KI_VARS_TEKST) {
          if (!m.test(n)) continue;
          navn = kn; under = ku; kjentIkon = ki; break;
        }
      }
      if (eget) navn = eget;
      if (egenUnder) under = egenUnder;
      ut.push({
        id, slug, kilde, plattform: (reg[id] || {}).platform || '',
        enhet: enhet || 'Annet',
        navn: navn.trim() || slug,
        under,
        ikon: (c.ikoner || {})[slug] || (c.ikoner || {})[id]
          || kjentIkon || a.icon || kiVarsIkon(`${slug} ${navn}`),
        pa: st.state === 'on',
        borte: ['unavailable', 'unknown'].includes(st.state),
      });
    };

    for (const [id, e] of Object.entries(reg)) {
      if (!plattformer.includes(e.platform)) continue;
      if (!id.startsWith('switch.') && !id.startsWith('input_boolean.')) continue;
      /* KI Energi har 206 entiteter på én enhet, og bare noen få er varslingsbrytere.
         Resten er styring, og hører hjemme i klimakortet. */
      if (e.platform === 'ki_energi' && !/varsel|varsler|spor_/.test(id)) continue;
      legg(id, 'integrasjon');
    }
    for (const id of (c.ekstra || [])) legg(id, 'ekstra');

    /* Én bryter per regel: hovedbryteren. Finner vi ingen, viser vi alle bryterne for
     * den regelen. KI Energi (`ikke_master:`) har sidestilte brytere – alle beholdes. */
    if (c.master !== false) {
      const utenMaster = [].concat(c.ikke_master || ['ki_energi']);
      const perEnhet = new Map();
      for (const b of ut) {
        if (b.kilde === 'ekstra' || utenMaster.includes(b.plattform)) continue;
        if (!perEnhet.has(b.enhet)) perEnhet.set(b.enhet, []);
        perEnhet.get(b.enhet).push(b);
      }

      const behold = new Set();
      /* Brytere fra unntatte integrasjoner beholdes alltid. */
      for (const b of ut) if (utenMaster.includes(b.plattform)) behold.add(b.id);
      for (const [, liste] of perEnhet) {
        if (liste.length <= 1) { liste.forEach((b) => behold.add(b.id)); continue; }
        const m = liste.filter(erMaster);
        (m.length ? m : liste).forEach((b) => behold.add(b.id));
      }
      for (let i = ut.length - 1; i >= 0; i--) {
        if (ut[i].kilde !== 'ekstra' && !behold.has(ut[i].id)) ut.splice(i, 1);
      }
    }

    /* Filtrering på ENHETSNAVN, ikke entitets-ID: delvis treff, uten hensyn til store bokstaver. */
    const treff = (navn, liste) => liste.some((m) =>
      String(navn).toLowerCase().includes(String(m).toLowerCase()));
    if (c.enheter && c.enheter.length) {
      for (let i = ut.length - 1; i >= 0; i--) {
        if (!treff(ut[i].enhet, c.enheter) && ut[i].kilde !== 'ekstra') ut.splice(i, 1);
      }
    }
    if (c.ikke_enheter && c.ikke_enheter.length) {
      for (let i = ut.length - 1; i >= 0; i--) {
        if (treff(ut[i].enhet, c.ikke_enheter)) ut.splice(i, 1);
      }
    }

    /* `bare:` er motsatt av `skjul:` og styrer også rekkefølgen. */
    const bare = (c.bare || []).map(String);
    if (bare.length) {
      const rang = new Map(bare.map((x, i) => [x, i]));
      return ut
        .filter((b) => rang.has(b.slug) || rang.has(b.id))
        .sort((a, b) => (rang.get(a.slug) ?? rang.get(a.id))
                      - (rang.get(b.slug) ?? rang.get(b.id)));
    }
    return ut.sort((a, b) => a.enhet.localeCompare(b.enhet, 'nb')
      || a.navn.localeCompare(b.navn, 'nb'));
  }

  /* Alle plattformer som har brytere hos deg, med antall (= KiVarslingEditor._plattformer).
     `varsler` = hvor mange som faktisk tas med (KI Energi: bare varslingsbryterne). */
  const VENNLIG = { ki_notifications: 'KI Varslinger', ki_energi: 'KI Energi', ki_utelys: 'KI Utelys' };
  function plattformNavn(h, p) {
    if (VENNLIG[p]) return VENNLIG[p];
    try { const t = h && h.localize && h.localize(`component.${p}.title`); if (t && t !== `component.${p}.title`) return t; } catch (e) { /* */ }
    return p;
  }
  function varslingPlattformer(h) {
    const reg = (h && h.entities) || {};
    const teller = {}, varsler = {};
    for (const [id, e] of Object.entries(reg)) {
      if (!id.startsWith('switch.') && !id.startsWith('input_boolean.')) continue;
      if (!e || !e.platform) continue;
      teller[e.platform] = (teller[e.platform] || 0) + 1;
      if (e.platform !== 'ki_energi' || /varsel|varsler|spor_/.test(id)) varsler[e.platform] = (varsler[e.platform] || 0) + 1;
    }
    return Object.entries(teller)
      .sort((a, b) => b[1] - a[1])
      .map(([p, n]) => {
        const v = varsler[p] || 0, navn = plattformNavn(h, p);
        return { value: p, n, varsler: v, navn, label: `${navn} (${n}${v !== n ? ` · ${v} varsler` : ''})` };
      });
  }

  M.KI_VARS_PLATTFORM = KI_VARS_PLATTFORM;
  M.KI_VARS_TEKST = KI_VARS_TEKST;
  M.KI_VARS_IKON = KI_VARS_IKON;
  M.kiVarsIkon = kiVarsIkon;
  M.kiVarsErMaster = erMaster;
  M.finnBrytere = finnBrytere;
  M.varslingPlattformer = varslingPlattformer;
  M.varslingPlattformNavn = plattformNavn;
  M.varslingSig = (L) => JSON.stringify((L || []).map((b) => [b.id, b.pa]));
})();
