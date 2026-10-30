"""Konstanter for KI MSH-integrasjonen."""

DOMAIN = "ki_msh"
NAVN = "KI MSH"

# Frontend: ki-msh.js ligger i integrasjonen (frontend/ki-msh.js, kopiert av build.mjs) og serveres herfra.
FRONTEND_URL = "/ki_msh_static"
FRONTEND_FIL = "ki-msh.js"
# Låst til en utgivelse – en ny Bubble Card-versjon tas inn bevisst (ikke @main, som kan endre seg uten varsel)
BUBBLE_CDN = "https://cdn.jsdelivr.net/gh/Clooos/Bubble-Card@v3.4.2/dist/bubble-card.js"

# Oppsett
CONF_DASHBORD = "dashbord"            # lag dashbordet automatisk
CONF_URL = "url_path"                 # dashbordets adresse (/ki-msh)
CONF_TITTEL = "tittel"
CONF_IKON = "ikon"
CONF_SIDEPANEL = "sidepanel"          # vis i sidepanelet
CONF_KUN_ADMIN = "kun_admin"
CONF_BUBBLE = "bubble"                # "auto" (CDN hvis Bubble Card mangler) | "cdn" | "av"
CONF_ROMSENSORER = "romsensorer"      # "auto" (bare uten KI Rom) | "alltid" | "av"
CONF_AREAS = "areas"
CONF_EKSKLUDER_ROM = "ekskluder_rom"
CONF_EXCLUDE = "exclude"
CONF_INCLUDE_CATEGORY = "include_category"
CONF_INCLUDE_GROUPS = "include_groups"
CONF_LAGRING = "lagring"              # "felles" (alle brukere, ki_msh/lager) | "bruker" (HAs user_data per bruker)
CONF_TEMP_RESERVE = "temp_reserve"    # temperatur når rommet/huset ikke har egen sensor
CONF_FUKT_RESERVE = "fukt_reserve"
CONF_PRIS = "pris"                    # strømprissensor (ellers funnet automatisk)

STD_URL = "ki-msh"
STD_TITTEL = "Hjem"
STD_IKON = "mdi:home-heart"
STD_LAGRING = "felles"

STRATEGI = {"strategy": {"type": "custom:ki-dashboard"}}

# Romtellerne er de samme som KI Rom lager (sensor.<rom>_lys … _oversikt). Dashbordet finner dem på
# attributtet `integrasjon: ki_rom` (MSH.kiRom i src/00-base.js), så markøren beholdes.
ROM_MARKOR = "ki_rom"
TOTALT_ID = "totalt"
TOTALT_NAVN = "Hele huset"

TRACKED_DOMAINS = (
    "light", "media_player", "switch", "binary_sensor", "sensor",
    "climate", "cover", "fan", "script", "scene",
)
SENSOR_CLASSES = {"power", "temperature", "humidity", "illuminance"}
ACTIVE_BINARY_CLASSES = {
    "motion", "occupancy", "presence", "moving", "vibration",
    "door", "window", "opening", "garage_door", "sound",
}

KIND_LYS = "lys"
KIND_MEDIA = "media"
KIND_BRYTERE = "brytere"
KIND_SENSORER = "sensorer"
KIND_EFFEKT = "effekt"
KIND_OVERSIKT = "oversikt"
KINDS = (KIND_LYS, KIND_MEDIA, KIND_BRYTERE, KIND_SENSORER, KIND_EFFEKT, KIND_OVERSIKT)

KIND_META = {
    KIND_LYS: {"navn": "Lys", "icon": "mdi:lightbulb-group-outline", "domain": "light",
               "aktiv_states": {"on"}, "ord_aktiv": "på", "ord_inaktiv": "av"},
    KIND_MEDIA: {"navn": "Media", "icon": "mdi:speaker", "domain": "media_player",
                 "aktiv_states": {"playing"}, "ord_aktiv": "spiller", "ord_inaktiv": "av"},
    KIND_BRYTERE: {"navn": "Brytere", "icon": "mdi:toggle-switch-outline", "domain": "switch",
                   "aktiv_states": {"on"}, "ord_aktiv": "på", "ord_inaktiv": "av"},
    KIND_SENSORER: {"navn": "Sensorer", "icon": "mdi:motion-sensor", "domain": "binary_sensor",
                    "aktiv_states": {"on"}, "ord_aktiv": "aktiv", "ord_inaktiv": "stille"},
    KIND_EFFEKT: {"navn": "Effekt", "icon": "mdi:flash", "domain": "sensor"},
    KIND_OVERSIKT: {"navn": "Oversikt", "icon": "mdi:floor-plan", "domain": None},
}

# Funksjons-popups dashbordet lager, og når de lages. Speiler M.FUNCTION_POPUPS (src/02-popups.js) og vilkårene i
# buildFunctionPopups (`cond`, src/04-strategy.js) + M.popupNeeds (40-basseng, 56-tesla, 61-strom, 65-planter …).
# Hold dem i takt: test/funksjoner-sync.mjs sjekker at hashene er de samme.
# Hver funksjon har en liste regler; funksjonen er aktiv når minst én regel treffer én entitet. I en regel må alle
# nøklene stemme for samme entitet:
#   domene / plattform / klasse (device_class) / produsent: verdi eller tuppel av verdier
#   rx: regex mot entitets-ID og navn (små bokstaver) · attributt: attributtet finnes · posisjon: har latitude
# Klienten (strategien) har siste ord – den ser også Tilpass-valg og egne regler (f.eks. Søvn per person).
_POOL_DOMENER = ("sensor", "switch", "input_boolean", "fan", "climate", "water_heater", "cover", "binary_sensor",
                 "light", "valve", "select", "input_select", "number", "input_number", "input_datetime", "counter")
_POOL_RX = r"basseng|baseng|sv[øo]mmebasseng|boblebad|jacuzzi|hot[\s_-]?tub|(^|[^a-zæøå])pool|(^|[^a-zæøå])spa($|[^a-zæøå])"
_PRINTER_RX = r"creality|bambu|prusa|elegoo|anycubic|voron|klipper|moonraker|octoprint|flashforge|qidi|snapmaker|3d.?print"

FUNKSJONER: list[dict] = [
    {"hash": "#kamera", "navn": "Kamera", "regler": [{"domene": "camera"}]},
    {"hash": "#media", "navn": "Media", "regler": [{"domene": "media_player"}]},
    {"hash": "#klima", "navn": "Klima", "regler": [{"domene": ("climate", "fan")}]},
    {"hash": "#ruter", "navn": "Ruter", "regler": [{"plattform": ("entur", "entur_public_transport", "entur_sx")}]},
    {"hash": "#vanning", "navn": "Vanning", "regler": [
        {"domene": "valve"}, {"plattform": "opensprinkler"},
        {"domene": ("switch", "valve", "input_boolean"), "rx": r"vanning|sprinkler|drypp|irrigation"}]},
    {"hash": "#basseng", "navn": "Basseng", "regler": [
        {"domene": _POOL_DOMENER, "rx": _POOL_RX},
        {"plattform": ("pentair", "intellicenter", "screenlogic", "omnilogic", "iaqualink", "hayward", "fluidra",
                       "astralpool", "poolsense", "ondilo_ico", "flipr", "blueriiot", "zodiac")},
        {"domene": "sensor", "klasse": "ph"}]},
    {"hash": "#sikkerhet", "navn": "Sikkerhet", "regler": [{"domene": ("alarm_control_panel", "lock")}]},
    {"hash": "#vaer", "navn": "Vær", "regler": [{"domene": "weather"}]},
    {"hash": "#lys", "navn": "Lys", "regler": [{"domene": "light"}]},
    {"hash": "#gjoremal", "navn": "Gjøremål", "regler": [{"domene": "todo"}]},
    {"hash": "#dorlas", "navn": "Dørlås", "regler": [{"domene": "lock"}]},
    {"hash": "#garasje", "navn": "Garasje", "regler": [{"domene": "cover", "klasse": "garage"}]},
    {"hash": "#ringeklokke", "navn": "Ringeklokke", "regler": [
        {"plattform": "unifiprotect", "domene": "binary_sensor", "rx": r"^binary_sensor\.\w+_doorbell$"},
        {"plattform": "unifiprotect", "domene": "event", "klasse": "doorbell"}]},
    {"hash": "#kart", "navn": "Kart", "regler": [{"domene": ("person", "device_tracker"), "posisjon": True}]},
    {"hash": "#strom", "navn": "Strøm", "regler": [
        {"domene": "sensor", "klasse": ("energy", "power"), "rx": r"strom|strøm|ams|han|maler|måler|meter|effekt|import"},
        {"plattform": ("nordpool", "tibber", "energidataservice")}]},
    {"hash": "#energi", "navn": "Energi", "regler": [{"domene": "sensor", "klasse": ("energy", "power", "water")}]},
    {"hash": "#kalender", "navn": "Kalender", "regler": [
        {"domene": "calendar"}, {"domene": "sensor", "rx": r"nar_kommer_posten"},
        {"plattform": ("norwegian_parcel_tracker", "postnord", "ki_hyttebesok")}]},
    {"hash": "#server", "navn": "Server", "regler": [
        {"plattform": ("unifi", "proxmoxve", "proxmox_sensors", "unraid", "hassio", "qbittorrent")}]},
    {"hash": "#tesla", "navn": "Tesla Model Y", "regler": [
        {"plattform": ("tesla_custom", "tesla_fleet", "teslemetry", "tessie")}, {"rx": r"^\w+\.(tesla_model_y|tesla)_"}]},
    {"hash": "#rolf", "navn": "Sir Sweeps", "regler": [{"domene": "vacuum"}]},
    {"hash": "#soppel", "navn": "Søppel", "regler": [{"domene": "sensor", "attributt": "days_to_pickup"}]},
    # #innstillinger lages bare når noe peker dit (innholdet ligger i #settings)
    {"hash": "#innstillinger", "navn": "Innstillinger", "regler": []},
    {"hash": "#varmepumpe", "navn": "Varmepumpe", "regler": [
        {"plattform": ("nibe_heatpump", "myuplink")}, {"produsent": r"nibe"}]},
    {"hash": "#planter", "navn": "Planter", "regler": [
        {"plattform": "ki_planter"}, {"domene": "plant"}, {"domene": "sensor", "klasse": "moisture"}]},
    {"hash": "#sovn", "navn": "Søvn", "regler": [
        {"domene": ("input_boolean", "binary_sensor", "switch"), "rx": r"sover|sleep|asleep|sovn_?modus"},
        {"domene": "input_datetime", "rx": r"vekking|alarm|wake"}]},
    {"hash": "#3d-printer", "navn": "3D-printer", "regler": [
        {"plattform": ("creality", "ha_creality_ws", "creality_k", "bambu_lab", "octoprint", "moonraker", "prusalink",
                       "elegoo_printer", "elegoo_cc", "anycubic_cloud", "flashforge")},
        {"produsent": _PRINTER_RX}]},
]
