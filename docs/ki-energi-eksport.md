# Eksport av KI Energi-data til testopptaket (fiks 15.12)

`npm run klima` kjører Klima-popupen (`#klima`, `msh-klima-card`) mot et opptak av KI Energi v2.32.0 i
`test/fixtures/ki-energi-2.32.json`. Fila er foreløpig **generert fra integrasjonens kildekode**
(`test/fixtures/ki-energi-2.32.gen.py`, feltet `"kilde": "generert"`). Når du har en ekte installasjon, erstatter du
den med en eksport slik – formatet er det samme, og testen regner forventede verdier ut av fila selv.

## 1 · Eksporter i nettleseren

Åpne Home Assistant som **administrator** (registeret krever admin), åpne utviklerkonsollen (F12 → Console) og lim inn:

```js
(async () => {
  const hass = document.querySelector('home-assistant').hass;
  const [entries, reg] = await Promise.all([
    hass.callWS({ type: 'config_entries/get', domain: 'ki_energi' }),
    hass.callWS({ type: 'config/entity_registry/list' }),
  ]);
  const entry = entries.find((e) => e.domain === 'ki_energi') || null;
  const ki = reg.filter((e) => e.platform === 'ki_energi');
  const kiIds = new Set(ki.map((e) => e.entity_id));
  // Brukerens egne entiteter som integrasjonen peker på (entiteter-kartet, laster, bereder …) + nettleie/strømmåler
  const tekst = JSON.stringify([...kiIds].map((id) => hass.states[id] && hass.states[id].attributes));
  const andre = new Set((tekst.match(/\b[a-z_]+\.[a-z0-9_]+\b/g) || []).filter((id) => hass.states[id] && !kiIds.has(id)));
  Object.keys(hass.states).filter((id) => /^sensor\.(nettleie_|strommaler_)/.test(id)).forEach((id) => andre.add(id));
  const ids = [...kiIds, ...andre];
  const dev = ki.find((e) => e.device_id) && hass.devices[ki.find((e) => e.device_id).device_id];
  const ut = {
    _om: 'Ekte eksport av hass.states + entitetsregisteret for KI Energi (docs/ki-energi-eksport.md).',
    kilde: 'eksport',
    integrasjon: { domain: 'ki_energi', versjon: (dev && dev.sw_version) || null },
    config_entry: entry && { entry_id: entry.entry_id, domain: entry.domain, title: entry.title, state: entry.state, source: entry.source },
    antall_ki_energi: ki.length,
    tid: new Date().toISOString(),
    entities: reg.filter((e) => ids.includes(e.entity_id)).map((e) => ({
      entity_id: e.entity_id, platform: e.platform, unique_id: e.unique_id, translation_key: e.translation_key ?? null,
      has_entity_name: e.has_entity_name, config_entry_id: e.config_entry_id, device_id: e.device_id, area_id: e.area_id,
      entity_category: e.entity_category, hidden_by: e.hidden_by, disabled_by: e.disabled_by, name: e.name,
      original_name: e.original_name, icon: e.icon,
    })),
    states: ids.filter((id) => hass.states[id]).map((id) => {
      const s = hass.states[id];
      return { entity_id: id, state: s.state, attributes: s.attributes, last_changed: s.last_changed, last_updated: s.last_updated };
    }),
  };
  const json = JSON.stringify(ut, null, 1);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = 'ki-energi-2.32.json';
  a.click();
  console.info('ki-energi-eksport', { entry: !!entry, entiteter: ki.length, states: ut.states.length,
    status: (hass.states['sensor.ki_energi_status'] || {}).state, statusId: (ki.find((e) => e.unique_id === 'ki_energi_ki_energi_status') || {}).entity_id });
})();
```

Nettleseren laster ned `ki-energi-2.32.json`. Konsollen viser antall entiteter (skal være 210 for v2.32.0 med
standardoppsett) og **hvilken entitets-ID statussensoren faktisk har** (`statusId`). Er den noe annet enn
`sensor.ki_energi_status` (f.eks. `sensor.ki_energi_status_2` fordi en gammel pakke-/template-sensor holdt på navnet),
er det nettopp det kortet nå slår opp via registeret.

Fila inneholder tilstandene til integrasjonen og entitetene den peker på (strømmåler, bereder, termostater, personer i
`personer`-attributtet). Se over den før du deler den, og fjern det du ikke vil ha med.

## 2 · Bytt opptaket og kjør testen

```sh
cp ~/Downloads/ki-energi-2.32.json test/fixtures/ki-energi-2.32.json
npm run klima
```

Testen (`test/klima-check.mjs`, datasettene `ki_energi_232` og `ki_energi_232_omdopt`) feiler hvis heroen viser
«Venter på KI Energi», popupen er tom, eller heroen ikke viser motorens tall fra statussensoren (sone, kW nå, ledig kW,
minutter igjen, brukt/grense kWh og prognosen fra `sensor.ki_estimert_timesforbruk`). Den sjekker også oppstartsloggen
`console.info('msh-klima-card', versjon, { entry, entiteter, status })`.

For å lage det genererte opptaket på nytt fra integrasjonens kode:

```sh
python3 test/fixtures/ki-energi-2.32.gen.py ../ki-strom/custom_components/ki_energi
```

## 3 · Feilsøking hos brukeren

Ved første visning av `#klima` logger kortet én linje i konsollen:

```
msh-klima-card 1.2.0 { entry: true, entiteter: 210, status: "gul" }
```

- `entry: false` og `entiteter: 0` → integrasjonen er ikke installert/lastet (kortet viser «Venter på KI Energi» og «Sett opp KI Energi»).
- `entiteter: 210`, `status: null` eller `"unavailable"` → statussensoren svarer ikke; kjør eksporten over og se `statusId`.
- `entry: false` men `entiteter > 0` → brukeren er ikke admin (config entry kan ikke leses), oppslaget bruker `hass.entities`.
