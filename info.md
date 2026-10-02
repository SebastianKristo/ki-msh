<img src="https://raw.githubusercontent.com/SebastianKristo/ki-msh/main/docs/images/icon.png" alt="KI MSH" width="96" height="96">

# KI MSH

My SmartHome v3-dashbordet for Home Assistant – custom cards i JavaScript, bygget for **Bubble Card-popups**.

- Strategien `custom:ki-dashboard` bygger Hjem, navbaren og én popup per rom og funksjon (Vanning, Varmepumpe, Server,
  Klima, Lys, Media, Kamera, Sikkerhet, Vær, Kalender, Energi, Tesla, Sir Sweeps …). Basseng-kortet legges manuelt i en
  egen popup (bassengpopupen lages ikke lenger).
- Alt autokonfigureres fra HA-områder, -registre og KI Rom – ingen eksempeldata.
- «Tilpass»-ark for Hjem, navbar, header, rom og hver popup, pluss GUI-editor for alle kort.

**Krever:** Home Assistant 2024.11+, [Bubble Card](https://github.com/Clooos/Bubble-Card) og temaet My SmartHome v3.

**Kom i gang:** nytt dashbord → *Rå konfigurasjon* →

```yaml
strategy:
  type: custom:ki-dashboard
```

Se [README](https://github.com/SebastianKristo/ki-msh#readme) for skjermbilder, popups og tilpasning.
