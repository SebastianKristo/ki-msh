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

## Oppdatering av Android-appen fra appen
- Hver push til `main` som endrer `app/` eller `src/` bygger en **signert** APK med `versionCode` = kjørenummeret i GitHub Actions,
  og legger `ki-msh.apk` + `latest.json` på grenen `android-oppdatering` (ingen GitHub Releases, så HACS påvirkes ikke).
- Ved oppstart sjekker appen `latest.json`. Er versjonen nyere, vises «Ny versjon av appen» med «Oppdater nå»: appen laster ned
  APK-en og åpner Androids installasjonsdialog (første gang må «Installer ukjente apper» tillates for KI MSH).
  «Se etter oppdatering» nederst på velkomstskjermen sjekker manuelt.
- Krever to repo-secrets (Settings → Secrets and variables → Actions): `ANDROID_KEYSTORE_B64` (keystore i base64, alias `kimsh`)
  og `ANDROID_KEYSTORE_PASSWORD`. Uten dem bygges en debug-APK og ingenting publiseres. Bruk alltid samme nøkkel – med ny nøkkel
  må appen avinstalleres før neste versjon kan installeres.
- Lage nøkkelen og legge den inn (på din egen maskin, med `gh` innlogget):
  ```bash
  P=$(openssl rand -hex 16)
  keytool -genkeypair -keystore ki-msh.jks -storetype PKCS12 -storepass "$P" -keypass "$P" -alias kimsh \
    -keyalg RSA -keysize 4096 -validity 36500 -dname "CN=KI MSH, C=NO"
  base64 < ki-msh.jks | tr -d '\n' | gh secret set ANDROID_KEYSTORE_B64 -R SebastianKristo/ki-msh
  printf %s "$P" | gh secret set ANDROID_KEYSTORE_PASSWORD -R SebastianKristo/ki-msh
  echo "Passord: $P"   # lagre ki-msh.jks og passordet trygt
  ```
- Native del: `android/app/src/main/java/no/kristo/kimsh/ApkUpdaterPlugin.java`, webdel: `web/update.js`.

## Struktur
- `web/` – appens egne sider (onboarding, `native.js`)
- `prototype/` – filer fra prototypen som ikke finnes i repoet (demo-runtime, Glimt, HA-innstillinger, Vær, `00-c-tilpass-ui.js`)
- `scripts/build-www.mjs` – setter sammen `www/`
- `assets/` – ikon og splash (kilde for `npx @capacitor/assets generate`)
- `android/`, `ios/` – native prosjekter

## Kjent begrensning
Når appen viser din ekte Home Assistant, kjører siden fra HA-serveren. Da har den ikke Capacitor-broen, så haptikk og
varsler der går via vanlig webvisning (som i nettleseren), ikke via Companion-appens integrasjon.
