# Avvik fra designet

Designfilene er prototyper med mock-data. Der HA ikke har tilsvarende data eller funksjon, er seksjonen beholdt i samme
rekkefølge men viser ekte data eller tom-tilstand («–» + «Velg entitet»). Oversikt over bevisste avvik:

## Generelt
- **Popupens ramme/header** tegnes av Bubble Card; designfilenes egne header/lukk-knapper er utelatt.
- **Hero/toppkort er egne kort** (`msh-*-hero-card`) som legges først i popupen.
- **Tilpass-menyene** i prototypene (localStorage) er erstattet av den felles editoren (`msh-editor`), som brukes både
  i HAs GUI-editor og i kortets egen «Tilpass», og lagrer til kortets YAML-config. Dra-og-slipp-rutenett i
  prototypenes editorer er blitt rekkefølge-lister med opp/ned og øye-bryter.
- **Langt trykk** åpner HAs egen more-info (ligger på rot-nivå, påvirkes ikke av popupens transform) i stedet for
  prototypens egne more-info-ark.
- **Negative sidemarger** (`margin: 0 -14px`) på vannrette rader er fjernet, så kortene aldri går utenfor sin bredde.
- **Mellomrom inni kort** følger designet (`var(--msh-gap, …)`); mellomrommet *mellom* kort er 8 px (Bubble).

## Per skjerm
- **Rom:** tannhjulet i klima-toppkortet åpner hele rom-tilpasningen. Designets «padT/padB» er Bubble-nivå og utelatt.
- **Hjem:** header og prosa er to kort (8 px mellom i stedet for 18). Hjemme/borte og søvn i personens hurtigark kan
  bare endres når det finnes en `input_boolean` for det (HA setter ikke `person.*`). Gjøremål på Hjem viser frist/liste
  i stedet for «hvem». Graf-romkortet bruker `gray100` som bakgrunn (designets `#232323` forsvinner mot dashbordet).
- **Navbar:** hvit profil har en diskret aktiv-pille (designet mangler aktiv-markering). Merker bruker regelmodellen
  (entitet + Over/Under/Er/Er ikke + verdi).
- **Klima:** designet viser en egen effektstyringsmotor HA ikke har. «Innlærte tidskonstanter» → temperaturtrend,
  «Helgevarsler» → oversikt over funne entiteter, varighetsknapper → HVAC-/forhåndsvalgmoduser, «Dusjvinduer» → når
  håndklevarmeren var på i dag.
- **Media:** transport og volum ligger i hovedkortet (designets rekkefølge), hero er karusellen. App-lister hentes fra
  spillerens `source_list` i stedet for redigerbare lister.
- **Kamera:** «Snakk» krever et skript i config (HA har ingen generell toveis-lyd); «Bilde» laster ned stillbildet.
  Status-merket viser faktisk tilstand i stedet for alltid «OPPTAK».
- **Sikkerhet:** «Merk lukket» skjuler varselet til sensoren endrer seg (kan ikke lukke en fysisk dør).
- **Ruter:** gangtid finnes ikke i HA og er config-tekst; linjevalg er et tekstfelt.
- **Vær:** valgfri temperaturgraf (`show_graph`, av som standard) er lagt til; «Forhåndsvis vær» (designverktøy) utelatt.
- **Vanning:** planen krever en vanningskalender; tidsstyrt kjøring med kø krever OpenSprinkler (ventiler/brytere
  åpnes bare, nedtellingen er et estimat).
- **Basseng:** flere verdier under «Styring og verdier» lagres som config (`vals.*`) og styrer ikke HA direkte.
- **Gjøremål:** prioritet lagres som prefiks `[h]`/`[m]`/`[l]` i beskrivelsen (HA har ikke prioritet); lister uten
  beskrivelse viser «Medium». Tjenesten er `todo.remove_item`.
- **Person:** søvnfaser tegnes som proporsjonale blokker (HA har ikke hypnogram).
