# Kanallogoer for radio (Fiks 51 A)

Logoene vises i mini-spilleren, utvidet meny, Media-popupen og spillerraden i Rom når en radiospiller
ikke sender `entity_picture` (felles hjelper `MSH.stationArt`, `src/06-station-art.js`).

Kopier PNG-filene i denne mappen (de ligger her i repoet) til HA, slik at de ligger i Home Assistant under
`config/www/ki/radio-logos/` og serveres som `/local/ki/radio-logos/<fil>`:

| Fil | Treff (kanalnavn) |
| --- | --- |
| `nrk-p1.png` | NRK 1, NRK P1, P1, NRK P1 <distrikt> (f.eks. NRK P1 Østfold) |
| `nrk-p1pluss.png` | NRK P1+, P1+, P1 pluss |
| `nrk-p2.png` | NRK P2, P2 |
| `nrk-p3.png` | NRK P3, P3, NRK P3 Musikk, P3 Musikk |
| `nrk-mp3.png` | NRK mP3, mP3 |
| `nrk-klassisk.png` | NRK Klassisk |
| `nrk-jazz.png` | NRK Jazz |
| `p4-lyden-av-norge.png` | P4, P4 Lyden av Norge, P4LydenAvNorge (contain på mørk flate) |
| `radio-vinyl.png` | Vinyl, Radio Vinyl (contain på mørk flate) |

Mangler en fil, vises tomtilstanden (radio-ikonet). Egne treff legges i Media-kortet
(«Tilpass media» → Musikk → Kanallogoer) eller i YAML:

```yaml
station_logos:
  "Radio Norge": /local/ki/radio-logos/radio-norge.png
```
