#!/usr/bin/env python3
"""Lager test/fixtures/ki-energi-2.32.json fra kildekoden til KI Energi v2.32.0 (fiks 15.12 punkt 6).

Vi har ikke brukerens eksport ennå, så opptaket er UTLEDET fra integrasjonens kode:
  · entitetslistene (SWITCHES, NUMBERS, TIMES, DATETIMES, TEXTS, SENSORS, BINARY_SENSORS, PERSON_*) i const.py,
  · entitets-ID = <domene>.<nøkkel>, unique_id = "ki_energi_<nøkkel>", ingen translation_key (entity.py),
  · per-person-, per-sone- og per-rom-entitetene fra switch.py / number.py / time.py,
  · attributtene slik engine.py, nettleie.py, vvb.py, modes.py, lading.py, prognose.py og sparing.py skriver dem.
Verdiene er et realistisk øyeblikk (gul sone, 23 min igjen av timen). Erstatt JSON-fila med en ekte eksport
når den finnes – se docs/ki-energi-eksport.md.

Bruk:  python3 test/fixtures/ki-energi-2.32.gen.py [sti/til/custom_components/ki_energi]
"""
from __future__ import annotations

import importlib.util
import json
import re
import sys
from pathlib import Path

HER = Path(__file__).resolve().parent
KILDE = Path(sys.argv[1]) if len(sys.argv) > 1 else HER.parents[2] / "ki-strom" / "custom_components" / "ki_energi"
spec = importlib.util.spec_from_file_location("ki_const", KILDE / "const.py")
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)
MANIFEST = json.loads((KILDE / "manifest.json").read_text())

TID = "2026-09-27T14:37:04.512345+00:00"
ENTRY_ID = "01K5KIENERGI0000000000000000"
DEVICE_ID = "d3f1c0ffee2320000000000000000001"

states: list[dict] = []
entities: list[dict] = []


def rom_slug(navn: str) -> str:  # som number.py
    t = str(navn or "").lower()
    for fra, til in (("ø", "o"), ("æ", "a"), ("å", "a"), ("ö", "o"), ("ä", "a")):
        t = t.replace(fra, til)
    return re.sub(r"[^a-z0-9]+", "_", t).strip("_")


def ki(domene: str, key: str, state, attrs: dict | None = None, navn: str = "", ikon: str | None = None) -> None:
    eid = f"{domene}.{key}"
    a = dict(attrs or {})
    a.setdefault("friendly_name", navn or key)
    if ikon:
        a.setdefault("icon", ikon)
    states.append({"entity_id": eid, "state": "unknown" if state is None else str(state), "attributes": a,
                   "last_changed": TID, "last_updated": TID})
    entities.append({"entity_id": eid, "platform": "ki_energi", "unique_id": f"ki_energi_{key}",
                     "translation_key": None, "has_entity_name": False, "config_entry_id": ENTRY_ID,
                     "device_id": DEVICE_ID, "area_id": None, "entity_category": None, "hidden_by": None,
                     "disabled_by": None, "name": None, "original_name": navn or key, "icon": None})


def ekstern(eid: str, state, attrs: dict, platform: str) -> None:
    states.append({"entity_id": eid, "state": str(state), "attributes": attrs, "last_changed": TID, "last_updated": TID})
    entities.append({"entity_id": eid, "platform": platform, "unique_id": f"{platform}_{eid.split('.')[1]}",
                     "translation_key": None, "config_entry_id": None, "device_id": None, "area_id": None,
                     "entity_category": None, "hidden_by": None, "disabled_by": None, "name": None, "icon": None})


# ------------------------------------------------------------------ oppsett (brukerens: eldre personfelt, standardsoner)
PERSONER = [{"key": "cybele", "navn": "Cybele", "type": "barn", "entity": "person.cybele"},
            {"key": "sebastian", "navn": "Sebastian", "type": "ungdom", "entity": "person.sebastian"},
            {"key": "rune", "navn": "Rune", "type": "voksen", "entity": "person.rune"}]
SONER = C.DEFAULT_SONER
LYSREGLER = [{"key": "gang", "navn": "Gang"}, {"key": "bad", "navn": "Bad"}]

# ------------------------------------------------------------------ hjelpere (switch/number/time/datetime/text)
SW_VERDI = {"ki_skyggemodus": False, "ki_helgemodus": False, "ki_sommer_auto": True}
for key, navn, std, ikon in C.SWITCHES:
    ki("switch", key, "on" if SW_VERDI.get(key, std) else "off", {}, navn, ikon)
for p in PERSONER:
    for suf, navn, std, ikon in C.PERSON_BRYTERE.get(p["type"], []):
        ki("switch", f"ki_{p['key']}_{suf}", "on" if std else "off", {}, f"KI {p['navn']} {navn}", ikon)
for r in LYSREGLER:
    ki("switch", f"ki_lys_{r['key']}", "on", {}, f"KI Lys {r['navn']}", "mdi:lightbulb-auto-outline")
for key, konf in SONER.items():
    ki("switch", f"ki_styr_{key}", "on", {}, f"KI Styrer {konf['navn']}", "mdi:robot")

NUM_VERDI = {"ki_maks_time_kwh": 6.0, "ki_mal_snitt_kwh": 4.7, "ki_elbil_effekt_kw": 3.5, "ki_stat_unngatte_topper": 14,
             "ki_stat_shed_hendelser": 83, "ki_stat_flyttet_kwh": 41.62, "ki_stat_spart_kr": 212.4, "ki_stat_komfortavvik": 6.31}
kjente = set()
for key, navn, mn, mx, steg, enhet, std, ikon in C.NUMBERS:
    kjente.add(key)
    ki("number", key, float(NUM_VERDI.get(key, std)), {"min": float(mn), "max": float(mx), "step": float(steg), "mode": "box",
       **({"unit_of_measurement": enhet} if enhet else {})}, navn, ikon)
for konf in SONER.values():
    for felt, navn, std in (("temp_dag", "Dag", 21), ("temp_natt", "Natt", 18), ("temp_borte", "Borte", 19)):
        hk = konf.get(felt) or ""
        if hk and hk not in kjente:
            kjente.add(hk)
            ki("number", hk, float(std), {"min": 5.0, "max": 30.0, "step": 0.5, "mode": "box", "unit_of_measurement": "°C"},
               f"KI Temp {konf['navn']} {navn}", "mdi:thermometer")
rom: dict[str, list] = {}
for key, konf in SONER.items():
    rom.setdefault(konf.get("rom") or konf["navn"], []).append((key, konf))
for r, soner in rom.items():
    ki("number", f"ki_rom_{rom_slug(r)}_temp", 21.0, {
        "min": 5.0, "max": 30.0, "step": 0.5, "mode": "box", "unit_of_measurement": "°C", "rom": r, "antall_kilder": len(soner),
        "kilder": [{"sone": k, "navn": c["navn"], "type": c.get("type", "panel"), "nominell_kw": c.get("nominell"), "klima": c.get("climate")} for k, c in soner]},
       f"KI Temp {r}", "mdi:home-thermometer")

for key, navn, std, ikon in C.TIMES:
    ki("time", key, std + ":00", {}, navn, ikon)
for p in PERSONER:
    for suf, navn, std, ikon in C.PERSON_TIDER.get(p["type"], []):
        ki("time", f"ki_{p['key']}_{suf}", std + ":00", {}, f"KI {p['navn']} {navn}", ikon)
DT_VERDI = {"ki_vvb_siste_godkjente_syklus": "2026-09-25T03:41:00+00:00"}
for key, navn, ikon in C.DATETIMES:
    ki("datetime", key, DT_VERDI.get(key), {}, navn, ikon)
for key, navn, ikon in C.TEXTS:
    ki("text", key, C.TARIFF_TABELL_STANDARD if key == "ki_tariff_tabell" else "", {"min": 0, "max": 255, "mode": "text", "pattern": None}, navn, ikon)

# ------------------------------------------------------------------ sensorer (motorens tilstand, som engine.py skriver)
S_NAVN = {k: (n, i, e) for k, n, i, e, _d, _s in C.SENSORS}


def sensor(key: str, state, attrs: dict | None = None) -> None:
    n, i, e = S_NAVN[key]
    ki("sensor", key, state, {**({"unit_of_measurement": e} if e else {}), **(attrs or {})}, n, i)


forbrukt, grense, minutter, tillatt, forventet = 2.94, 4.9, 23.0, 5.12, 4.31
plan = [
    dict(navn="Stue", rom="Stue", key="stue", type="panel", prio=3, handling="normal", mal=22.0, settpunkt=22.0, naa=21.6, effekt=1.1),
    dict(navn="Trappegang", rom="Trappegang", key="trappegang", type="panel", prio=3, handling="senket", mal=20.0, settpunkt=18.5, naa=19.4, effekt=0.0),
    dict(navn="Kjøkken panelovn", rom="Kjøkken", key="kjokken_panelovn", type="panel", prio=3, handling="normal", mal=22.0, settpunkt=22.0, naa=21.8, effekt=0.4),
    dict(navn="Soverom barn", rom="Soverom barn", key="soverom_barn", type="panel", prio=3, handling="normal", mal=19.0, settpunkt=19.0, naa=19.3, effekt=0.0, person="cybele", person_type="barn"),
    dict(navn="Soverom ungdom", rom="Soverom ungdom", key="soverom_ungdom", type="panel", prio=3, handling="vindu", mal=21.0, settpunkt=12.0, naa=17.9, effekt=0.0, vindu=True, vindu_navn="Vindu Sebastian", person="sebastian", person_type="ungdom"),
    dict(navn="Kjøkken gulvvarme", rom="Kjøkken", key="kjokken_gulv", type="gulv", prio=3, handling="normal", mal=24.0, settpunkt=24.0, naa=23.7, effekt=0.8),
    dict(navn="Bad gulvvarme", rom="Bad", key="bad_gulv", type="gulv", prio=2, handling="normal", mal=24.0, settpunkt=24.0, naa=24.1, effekt=0.0),
    dict(navn="Vaskegang gulvvarme", rom="Vaskegang", key="vaskegang_gulv", type="gulv", prio=4, handling="senket", mal=20.0, settpunkt=17.0, naa=19.2, effekt=0.0),
    dict(navn="Do gulvvarme", rom="Do", key="do_gulv", type="gulv", prio=4, handling="manuell", mal=21.0, settpunkt=21.0, naa=20.4, effekt=0.3),
]
# hub.soner(): climate/effekt normaliseres til første entitet + climater/effekter (alle)
for konf in SONER.values():
    for felt, flertall in (("climate", "climater"), ("effekt", "effekter")):
        v = konf.get(felt)
        liste = [x for x in (v if isinstance(v, list) else [v]) if x]
        konf[flertall], konf[felt] = liste, (liste[0] if liste else "")
laster = []
for p in plan:
    konf = SONER[p["key"]]
    laster.append({**{"forklaring": {"normal": "Holder målet", "senket": "Senket for å holde timen", "vindu": "Vindu åpent — holder 12 °C", "manuell": "Manuelt til 15:30"}[p["handling"]],
                   "overstyrt": p["handling"] == "manuell", "overstyrt_til": "2026-09-27T15:30:00+02:00" if p["handling"] == "manuell" else None,
                   "overstyrt_temp": 21.0 if p["handling"] == "manuell" else None,
                   "helpere": [[konf.get(f), n] for f, n in (("temp_dag", "Dag"), ("temp_natt", "Natt"), ("temp_borte", "Borte")) if konf.get(f)],
                   "styr": f"switch.ki_styr_{p['key']}",
                   "entiteter": [e for e in konf["climater"] + konf["effekter"] + [konf.get("duty"), konf.get("temp")] if e],
                   "vindu": False, "vindu_navn": "", "leggetid": False, "profil": konf.get("profil"), "person": None, "person_type": None,
                   "forvarm_start": None, "forvarm": False, "skriving": None, "venter": False}, **p})
laster.append(dict(navn="Varmtvannsbereder", rom="Varmtvann", key="vvb", type="bryter", prio=2, handling="av", mal=None, settpunkt=None, naa=None,
                   effekt=0.0, forklaring="Utenfor vinduet. Styres av varmtvannsdelen, motoren reserverer effekt.", overstyrt=False, helpere=[], styr=None))
senket = [p for p in plan if p["handling"] == "senket"]
tanker = [
    "Modus AUTO. Timegrensen er 4.90 kWh.",
    f"Denne timen: {forbrukt:.2f} kWh brukt, {grense - forbrukt:.2f} kWh igjen på {int(minutter)} min. Tillatt snitteffekt: {tillatt:.2f} kW.",
    f"Forventer {forventet:.2f} kW nå (1.61 kW uregulert + 2.70 kW styrt), 4.4 kW om 15 min og 3.9 kW om en time.",
    "Nettleie: dagens døgnmaks er 4.62 kWh (kl. 07); timer opp til det koster ingenting ekstra.",
    "Senker nå: " + ", ".join(f"{p['navn']} til {p['settpunkt']} °C" for p in senket) + ".",
]
sensor("ki_energi_status", "gul", {
    "forklaring": "Senker trappegang, vaskegang gulvvarme for å holde timen under 4.90 kWh.", "tankegang": tanker, "skyggemodus": False,
    "modus": "AUTO", "hustype": "bolig",
    "personer": [{"key": p["key"], "navn": p["navn"], "type": p["type"], "hjemme": k != 0} for k, p in enumerate(PERSONER)],
    "gardiner": False, "hanklevarmer": True, "elbil": True, "lading": False, "bad_fukt": False,
    "entiteter": {"total_effekt": "sensor.strommaler_effekt", "importert_energi": "sensor.strommaler_imported_energy",
                  "ute_temp": "sensor.outdoor_meter_temperature", "vaer": "weather.forecast_home", "topp1": "sensor.nettleie_elvia_toppforbruk",
                  "topp2": "sensor.nettleie_elvia_toppforbruk_2", "topp3": "sensor.nettleie_elvia_toppforbruk_3"},
    "vvb_bryter": True, "vvb_effekt": True,
    "grense_kwh": grense, "grense_grunn": "dynamisk (topp tre)", "forbrukt_kwh": forbrukt, "igjen_kwh": round(grense - forbrukt, 3),
    "minutter_igjen": minutter, "feil": {}, "ticks_hoppet_over": 0,
    "tillatt_effekt_kw": tillatt, "forventet_effekt_kw": forventet, "uregulert_kw": 1.61, "uregulert_60_kw": 1.2,
    "prognose_15_kw": 4.4, "prognose_30_kw": 4.1, "prognose_60_kw": 3.9, "prognose_120_kw": 3.2,
    "vvb_reservert_kw": 0.0, "vvb_grunn": "Utenfor vinduet", "ledig_kw": 0.81, "lading_kw": 0.0, "solfaktor": 0.12,
    "malekilde": "energiregister (sensor.strommaler_imported_energy)", "tak_aktivt": False,
    "lagring": ".storage (integrasjon)", "lagring_ok": True, "profil_oppforinger": 1344, "tau_soner": 9,
    "endringer": [], "usikkert_grunnlag": False})
sensor("ki_lading_status", "ingen", {"forklaring": "Laderen er ikke satt opp i integrasjonen.", "trinn_a": 0, "effekt_kw": 0.0, "ledig_kw": 0.81,
       "malt_kw": None, "satt_trinn_a": None, "trinn_tilgjengelig": [], "sist_endret": None, "automatikk": True, "batteri_pst": None,
       "stopp_ved_pst": 80.0, "start_under_pst": 70.0, "fulladet": False, "hjemme": None, "sted_navn": ""})
sensor("ki_laster", str(len(senket)), {"laster": laster})
sensor("ki_bereder", "Sikret", {"reservert_kw": 0.0, "forklaring": "Utenfor vinduet", "dager_siden_syklus": 2.5, "tvungen_syklus": False,
       "bryter": "switch.varmtvannsbereder", "bryter_pa": False, "effekt_sensor": "sensor.varmtvannsbereder_power", "effekt_w": 0.0, "varmer": False,
       "legionella_aktiv": True, "sikret": True, "forfalt": False, "siste_syklus": "2026-09-25T05:41:00+02:00", "neste_frist": "2026-10-02T05:41:00+02:00",
       "onsket_innen": "2026-09-28T05:41:00+02:00", "intervall_dager": 3.0, "hard_frist_dager": 7.0, "vindu": "22:00–05:00", "boost_til": None})
sensor("ki_hanklevarmer", "av", {"forklaring": "Utenfor morgen- og kveldsvinduet", "spart_kr_maned": 18.2, "spart_kwh_maned": 11.6})
sensor("ki_gardiner", "ikke_konfigurert", {"forklaring": "Ingen gardin/cover er valgt i integrasjonen."})
sensor("ki_beslutningslogg", "2026-09-27 14:31:02", {"linjer": [
    {"tid": "2026-09-27 14:31:02", "sone": "gul", "skygge": False, "forbrukt": 2.61, "grense": 4.9, "forventet_kw": 4.52,
     "forklaring": "Senker trappegang, vaskegang gulvvarme for å holde timen under 4.90 kWh.",
     "tiltak": ["Trappegang: senket → 18.5 °C (Senket for å holde timen)", "Vaskegang gulvvarme: senket → 17.0 °C (Senket for å holde timen)"]},
    {"tid": "2026-09-27 07:12:40", "sone": "oransje", "skygge": False, "forbrukt": 3.9, "grense": 4.9, "forventet_kw": 5.3,
     "forklaring": "Timen har 1.00 kWh igjen av 4.90. Forventet 5.30 kW mot tillatt 5.10 kW.", "tiltak": ["Stue: senket → 20.5 °C (Senket for å holde timen)"]},
]})
sensor("ki_tidskonstanter", "9", {"soner": {c["navn"]: {"tau_timer": t, "grader_per_time": g, "malinger": n} for c, t, g, n in
       zip(SONER.values(), (38.2, 21.5, 30.0, 26.4, 24.9, 61.0, 55.3, 48.7, 44.1), (1.1, 0.9, 1.3, 1.0, 0.8, 0.35, 0.4, 0.3, 0.32), (212, 180, 164, 97, 88, 140, 151, 42, 19))}})
sensor("ki_klima_status", "Normal", {"modus": "AUTO", "helgemodus": False, "sommermodus": False, "hjemkomst": False, "skyggemodus": False, "overstyringer": ["do_gulv"]})
sensor("ki_prognose", 4.4, {"om_15_min_kw": 4.4, "om_30_min_kw": 4.1, "om_60_min_kw": 3.9, "om_120_min_kw": 3.2, "styrt_kw": 2.7, "tillatt_kw": tillatt,
       "topp_forventet": 15, "forklaring": "Ingen topp i sikte de neste to timene (maks 4.4 kW)."})
sensor("ki_besparelse", 212.4, {"estimat": True, "merknad": "Estimat uten kontrollgruppe. Unngåtte topper = timer motoren holdt innenfor 90–100 % av grensen.",
       "spart_kwh_estimert": 4.16, "flyttet_kwh": 41.62, "unngatte_topper": 14, "utkoblinger": 83, "komfortavvik_gradtimer": 6.31,
       "spart_nettleie_kr": 5.91, "trinn_diff_kr": 170.0, "spart_effektledd_kr": 793.33})
sensor("ki_overgang_klar", "Lærer fortsatt", {"hindringer": ["Få målinger for: Do gulvvarme"], "antall_hindringer": 1})
sensor("ki_styrt_effekt", 2700.0, {"device_class": "power", "state_class": "measurement"})
sensor("ki_uregulert_effekt", 1610.0, {"device_class": "power", "state_class": "measurement"})
sensor("ki_hvitevarer_effekt", 0.0, {"device_class": "power", "state_class": "measurement"})
sensor("ki_time_energi", forbrukt, {"device_class": "energy", "state_class": "total"})
tabell = [[float(g), float(k)] for g, k in (t.split(":") for t in C.TARIFF_TABELL_STANDARD.split(","))]
sensor("ki_nettleie", 250.0, {
    "grense_kwh": grense, "hvorfor": "Dagens døgnmaks er alt 4.62 kWh (kl. 07). Timer opp til det endrer ingenting — derfor er grensen 4.90.",
    "fri_tak_kwh": 4.62, "tak_okonomi_kwh": 4.9, "hard_kwh": 6.0, "reserve_kwh": 0.3, "reserve_grunner": ["fast reserve 0.30 kWh"],
    "mal_kw": 5.0, "effektivt_mal_kw": 5.0, "mal_tapt": False, "tillat_dyrere_trinn": False, "tariff_ukjent": False,
    "datakvalitet": "god", "datakvalitet_grunner": [], "dagens_maks_kwh": 4.62, "dagens_maks_time": "07", "dagens_kvalitet": "malt",
    "topp_tre": [{"dato": "2026-09-08", "kilde": "egen", "time": "18", "kvalitet": "malt", "kwh": 4.81},
                 {"dato": "2026-09-15", "kilde": "egen", "time": "07", "kvalitet": "malt", "kwh": 4.77},
                 {"dato": "2026-09-22", "kilde": "egen", "time": "17", "kvalitet": "malt", "kwh": 4.64}],
    "registrert_snitt": 4.74, "registrert_trinn_kr": 250.0, "registrert_trinn_fra": 2.0, "registrert_trinn_til": 5.0,
    "kjente_dager": 26, "udaterte_topper": 0, "dager_igjen": 3, "placeholder_kwh": None, "tabell": tabell,
    "timer_siste_12": [{"start": f"2026-09-27T{h:02d}:00:00+00:00", "kwh": k, "kvalitet": "malt"} for h, k in
                       zip(range(0, 12), (1.9, 1.7, 1.6, 1.8, 2.3, 4.62, 3.9, 3.1, 2.8, 2.6, 3.4, 3.7))],
    "dogn_maned": [{"dato": f"2026-09-{d:02d}", "kwh": round(3.2 + (d * 37 % 15) / 10, 2), "time": "07", "kvalitet": "malt", "kjente_timer": 24,
                    "manglende_timer": 0, "topp": d in (8, 15, 22)} for d in range(1, 27)],
    "forventet_time_kwh": 4.59, "forventet_dognmaks_kwh": 4.62, "forventet_topp_tre": None, "forventet_snitt": 4.74, "forventet_trinn_kr": 250.0,
    "okning_fastledd_kr": 0.0, "hoyere_dognmaks": False, "hoyere_snitt": False, "hoyere_fastledd": False, "redusert_margin": False,
    "forklaring": "Dagens døgnmaks 4.62 kWh (kl. 07, malt). Topp tre gir snitt 4.74 kW → 250 kr/mnd."})
sensor("ki_sparing", 96.3, {"poster": {"motor": {"kwh": 18.1, "kr": 61.4, "tekst": "Flyttet varme til billigere timer, unngått topper"},
       "gardiner": {"kwh": 0.0, "kr": 0.0, "potensial_kwh": 0.0, "potensial_kr": 0.0, "tekst": "Mindre varmetap gjennom vinduene om natten"},
       "hanklevarmer": {"kwh": 11.6, "kr": 18.2, "tekst": "Av utenom dusjvinduene"},
       "bereder": {"kwh": 52.0, "kr": 16.7, "tekst": "Varmet i nattariff i stedet for dagtariff"},
       "lys": {"kwh": 0.0, "kr": 0.0, "tekst": "Glemte lys slått av, nattdemping"}},
       "total_kr_maned": 96.3, "total_kwh_maned": 81.7, "gardin_kunne_spart_kr": 0.0, "maned": "2026-09", "pris_kr_kwh": 0.5, "nettleie_diff_kr": 0.32,
       "forklaring": "KI Energi har spart ca. 96 kr (81.7 kWh) denne måneden.", "merknad": "Anslag uten kontrollgruppe."})
sensor("ki_prognoselaering", "lært", {"kwh": 0.21, "status": "lært", "kilde": "hverdag_ettermiddag", "grunn": "Prognosene har truffet godt.",
       "intervall_kwh": [-0.12, 0.21], "dekning_observert": 0.82, "n_dekning": 311, "forventet_slutt_kwh": 4.59, "forventet_ovre_kwh": 4.8,
       "prognoseintervall_kwh": [4.47, 4.8], "strategisk_reserve_kwh": 0.3, "margin_kw_naa": 0.548, "modell": 3,
       "forklaring": "Forventet 4.59 kWh ved timeslutt (+0.21 kWh margin = 4.80). Status: lært."})
sensor("ki_lys", 2, {"regler": [{"key": "gang", "navn": "Gang", "aktiv": True, "status": "av_lys", "tekst": "Lyset er av"},
       {"key": "bad", "navn": "Bad", "aktiv": True, "status": "utenfor", "tekst": "Utenfor tidsvinduet — rører ikke lyset"}],
       "spart_kwh_i_dag": 0.04, "spart_kwh_maned": 1.2, "spart_kr_maned": 1.8})
sensor("ki_estimert_timesforbruk", 4.59, {"state_class": "measurement"})
sensor("ki_vvb_legionella_status", "Sikret", {"dager_siden_syklus": 2.5, "intervall_dager": 3.0, "hard_frist_dager": 7.0, "tvungen": False, "legionella_aktiv": True})
sensor("ki_vvb_forklaring", "Siste bekreftede metning for 2,5 døgn siden. Neste oppvarming i nattvinduet 22:00–05:00.")
sensor("ki_vvb_dager_siden_siste_syklus", 2.5)
sensor("ki_vvb_oppvarming_minutter", 0)
sensor("ki_vvb_billige_timer", 6, {"timer": [0, 1, 2, 3, 4, 23], "metode": "Ikke i bruk. Berederen følger vinduet, ikke enkelttimer.",
       "antall_kandidater": 48, "norgespris": True, "har_priser": True,
       "doegn": [{"t": (16 + i) % 24, "pris": 0.5, "valgt": (16 + i) % 24 in (22, 23, 0, 1, 2, 3, 4), "vindu": (16 + i) % 24 in (22, 23, 0, 1, 2, 3, 4), "naa": i == 0} for i in range(24)]})
sensor("ki_tilstedevaerelse", "hjemme", {"tekst": "Hjemme", "borte_siden": None, "minutter_borte": None, "bortemodus": False, "hjemkomst_aktiv": False,
       "venter_svar": False, "auto_etter_timer": 6.0, "hjemkomst_tid": None})

B_NAVN = {k: (n, i, d) for k, n, i, d in C.BINARY_SENSORS}
B_VERDI = {"ki_alle_borte": False, "ki_vvb_mettet": True, "ki_vvb_legionella_ok": True, "ki_vvb_billig_time_na": False}
for key, (n, i, d) in B_NAVN.items():
    ki("binary_sensor", key, "on" if B_VERDI.get(key, False) else "off", {"device_class": d} if d else {}, n, i)

# ------------------------------------------------------------------ brukerens egne entiteter som integrasjonen/kortet leser
ekstern("sensor.strommaler_effekt", 4310, {"unit_of_measurement": "W", "device_class": "power", "friendly_name": "Strømmåler effekt"}, "tibber")
ekstern("sensor.strommaler_imported_energy", 18244.61, {"unit_of_measurement": "kWh", "device_class": "energy", "friendly_name": "Strømmåler importert"}, "tibber")
ekstern("sensor.outdoor_meter_temperature", 8.4, {"unit_of_measurement": "°C", "device_class": "temperature", "friendly_name": "Ute"}, "netatmo")
ekstern("switch.varmtvannsbereder", "off", {"friendly_name": "Varmtvannsbereder"}, "shelly")
ekstern("sensor.varmtvannsbereder_power", 0, {"unit_of_measurement": "W", "device_class": "power", "friendly_name": "Varmtvannsbereder effekt"}, "shelly")
for eid, v, n in (("sensor.nettleie_elvia_kapasitetstrinn", 250, "Kapasitetstrinn"), ("sensor.nettleie_elvia_toppforbruk", 4.81, "Toppforbruk 1"),
                  ("sensor.nettleie_elvia_toppforbruk_2", 4.77, "Toppforbruk 2"), ("sensor.nettleie_elvia_toppforbruk_3", 4.64, "Toppforbruk 3")):
    ekstern(eid, v, {"friendly_name": n, **({"unit_of_measurement": "kWh"} if "topp" in eid else {"unit_of_measurement": "kr"})}, "nettleie_elvia")
for key, konf in SONER.items():
    for c in konf["climater"]:
        if not any(s["entity_id"] == c for s in states):
            p = next((x for x in plan if x["key"] == key), {})
            ekstern(c, "heat", {"temperature": p.get("settpunkt", 21.0), "current_temperature": p.get("naa", 21.0), "hvac_modes": ["off", "heat"],
                                "hvac_action": "heating" if p.get("effekt") else "idle", "min_temp": 5, "max_temp": 30, "target_temp_step": 0.5,
                                "friendly_name": konf["navn"]}, "mill")

ki_n = sum(1 for e in entities if e["platform"] == "ki_energi")
ut = {
    "_om": ("Opptak av hass.states + entitetsregisteret for KI Energi v2.32.0. GENERERT fra integrasjonens kildekode "
            "(test/fixtures/ki-energi-2.32.gen.py), ikke eksportert fra en ekte installasjon. Erstatt med ekte eksport når den "
            "finnes (docs/ki-energi-eksport.md) – formatet er det samme: states[] og entities[]."),
    "kilde": "generert", "integrasjon": {"domain": "ki_energi", "versjon": MANIFEST.get("version")},
    "config_entry": {"entry_id": ENTRY_ID, "domain": "ki_energi", "title": "KI Energi", "state": "loaded", "source": "user"},
    "antall_ki_energi": ki_n, "tid": TID,
    "entities": entities, "states": states,
}
(HER / "ki-energi-2.32.json").write_text(json.dumps(ut, ensure_ascii=False, indent=1) + "\n")
print(f"skrev ki-energi-2.32.json: {ki_n} ki_energi-entiteter, {len(states)} states totalt")
