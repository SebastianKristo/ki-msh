# KI MSH-appen (iOS og Android)

Et Capacitor-skall rundt Home Assistant med KI MSH-dashbordet, bygget fra prototypen
«Home Assistant App» (Claude Design). Samme kode gir både iOS- og Android-appen.

## Hva appen gjør
- **Onboarding** (`web/index.html`): Velkommen → Velg server → Logg inn → Klar.
  - Søker etter `homeassistant.local:8123` og `homeassistant:8123`, eller du skriver inn adressen (lokal IP, ekstern URL, Nabu Casa).
  - Valgfri dashbordsti, f.eks. `/ki-msh`.
  - Innlogging i appen via HAs `login_flow` (støtter tofaktorkode). Koden gis til HA-frontenden med `?auth_callback=1`, som henter og lagrer tokenet selv. Alternativt kan du logge inn på HAs egen side.
  - Neste oppstart åpner dashbordet direkte (med «Bytt server» i 1,2 s).
- **Demo uten server**: hele `src/` kjørt uendret med testdataene i `test/mock/`, som i prototypen (`prototype/ki/runtime.html`).
- Native haptikk i onboarding og demo (HA-eventet `haptic` → Capacitor Haptics).

## Bygge
```bash
cd app
npm ci
npm run build          # lager www/ (onboarding + demo med src/ og testdata)
npx cap sync           # kopierer www/ inn i android/ og ios/
```
- **Android**: `cd android && ./gradlew assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk` (krever Android SDK, JDK 21). Eller åpne `android/` i Android Studio.
- **iOS**: `npx cap open ios` og kjør fra Xcode (krever Mac med Xcode). Velg ditt team under Signing for å installere på egen iPhone.
- **GitHub Actions** (`.github/workflows/app.yml`) bygger APK, simulator-app og usignert `.ipa` ved hver endring i `app/` eller `src/`. Filene ligger under «Artifacts» på kjøringen.

## Struktur
- `web/` – appens egne sider (onboarding, `native.js`)
- `prototype/` – filer fra prototypen som ikke finnes i repoet (demo-runtime, Glimt, HA-innstillinger, Vær, `00-c-tilpass-ui.js`)
- `scripts/build-www.mjs` – setter sammen `www/`
- `assets/` – ikon og splash (kilde for `npx @capacitor/assets generate`)
- `android/`, `ios/` – native prosjekter

## Kjent begrensning
Når appen viser din ekte Home Assistant, kjører siden fra HA-serveren. Da har den ikke Capacitor-broen, så haptikk og
varsler der går via vanlig webvisning (som i nettleseren), ikke via Companion-appens integrasjon.
