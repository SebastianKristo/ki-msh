"""Husmodellen: kartlegging fra registrene (hub._build) og funksjons-popupene (_finn_funksjoner)."""
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.ki_msh.const import DOMAIN, FUNKSJONER, KIND_LYS, KIND_OVERSIKT
from custom_components.ki_msh.hub import KiMshHub


def _entry(hass, **options):
    entry = MockConfigEntry(domain=DOMAIN, data={}, options=options)
    entry.add_to_hass(hass)
    return entry


async def _hus(hass):
    """Stue (lys på entiteten + lampe via enhetens område), kjøkken (bevegelse), bod (tomt), et skjult og et deaktivert lys."""
    areas, ents, devs = ar.async_get(hass), er.async_get(hass), dr.async_get(hass)
    stue, kjokken, bod = (areas.async_create(n) for n in ("Stue", "Kjøkken", "Bod"))
    cfg = MockConfigEntry(domain="test")
    cfg.add_to_hass(hass)
    lampe = devs.async_get_or_create(config_entry_id=cfg.entry_id, identifiers={("test", "lampe")},
                                     manufacturer="IKEA", name="Lampe")
    devs.async_update_device(lampe.id, area_id=stue.id)
    tak = ents.async_get_or_create("light", "test", "tak", suggested_object_id="stue_tak")
    ents.async_update_entity(tak.entity_id, area_id=stue.id)
    gulv = ents.async_get_or_create("light", "test", "gulv", suggested_object_id="stue_gulv", device_id=lampe.id)
    effekt = ents.async_get_or_create("sensor", "test", "effekt", suggested_object_id="lampe_effekt",
                                      device_id=lampe.id, original_device_class="power")
    temp = ents.async_get_or_create("sensor", "test", "batteri", suggested_object_id="lampe_batteri",
                                    device_id=lampe.id, original_device_class="battery")
    bev = ents.async_get_or_create("binary_sensor", "test", "bev", suggested_object_id="kjokken_bevegelse",
                                   original_device_class="motion")
    ents.async_update_entity(bev.entity_id, area_id=kjokken.id)
    skjult = ents.async_get_or_create("light", "test", "skjult", suggested_object_id="stue_skjult",
                                      hidden_by=er.RegistryEntryHider.USER)
    ents.async_update_entity(skjult.entity_id, area_id=stue.id)
    av = ents.async_get_or_create("light", "test", "av", suggested_object_id="stue_av",
                                  disabled_by=er.RegistryEntryDisabler.USER)
    ents.async_update_entity(av.entity_id, area_id=stue.id)
    hass.states.async_set(tak.entity_id, "on", {"friendly_name": "Taklampe"})
    hass.states.async_set(gulv.entity_id, "off", {"friendly_name": "Gulvlampe"})
    hass.states.async_set(effekt.entity_id, "1.5", {"unit_of_measurement": "kW", "device_class": "power"})
    hass.states.async_set(temp.entity_id, "80", {"device_class": "battery"})
    hass.states.async_set(bev.entity_id, "on", {"device_class": "motion"})
    return {"stue": stue.id, "kjokken": kjokken.id, "bod": bod.id, "tak": tak.entity_id, "gulv": gulv.entity_id,
            "effekt": effekt.entity_id, "batteri": temp.entity_id, "bev": bev.entity_id,
            "skjult": skjult.entity_id, "av": av.entity_id}


async def test_build_kartlegger_rom_fra_registrene(hass):
    h = await _hus(hass)
    hub = KiMshHub(hass, _entry(hass), romsensorer=True)
    hub._build()

    assert list(hub.areas.values()) == ["Bod", "Kjøkken", "Stue"]  # sortert på navn
    # Lyset på entiteten og lampen via enhetens område; skjult og deaktivert er ikke med
    assert hub.entity_ids(h["stue"], "light") == sorted([h["tak"], h["gulv"]])
    # Bare sensorklassene rommet bruker (power, ikke battery)
    assert hub.entity_ids(h["stue"], "sensor") == [h["effekt"]]
    assert hub.entity_ids(h["kjokken"], "binary_sensor") == [h["bev"]]
    assert hub.entity_ids(h["bod"], "light") == []

    lys = hub.compute(h["stue"], KIND_LYS)
    assert lys["value"] == 1 and lys["attrs"]["aktiv_liste"] == [h["tak"]]
    oversikt = hub.compute(h["stue"], KIND_OVERSIKT)
    assert oversikt["attrs"]["integrasjon"] == "ki_rom"  # MSH.kiRom finner romtellerne på denne
    assert oversikt["attrs"]["effekt"] == [h["effekt"]]

    hus = hub.hus()
    assert [r["navn"] for r in hus["rom"]] == ["Bod", "Kjøkken", "Stue"]
    assert "#lys" in hus["popups"] and "#kamera" not in hus["popups"]


async def test_build_folger_valgene(hass):
    h = await _hus(hass)
    hub = KiMshHub(hass, _entry(hass, ekskluder_rom=[h["bod"]], exclude=[h["gulv"]]), romsensorer=True)
    hub._build()
    assert h["bod"] not in hub.areas
    assert hub.entity_ids(h["stue"], "light") == [h["tak"]]

    hub = KiMshHub(hass, _entry(hass, areas=[h["kjokken"]]), romsensorer=True)
    hub._build()
    assert list(hub.areas) == [h["kjokken"]]


async def test_build_funksjoner_bare_fra_entiteter_som_finnes(hass):
    """En registeroppføring uten tilstand (f.eks. en integrasjon som ikke har startet) gir ingen popup."""
    ents = er.async_get(hass)
    ents.async_get_or_create("camera", "test", "inngang", suggested_object_id="inngang")
    hub = KiMshHub(hass, _entry(hass), romsensorer=False)
    hub._build()
    assert not next(f for f in hub.funksjoner if f["hash"] == "#kamera")["aktiv"]

    hass.states.async_set("camera.inngang", "idle")
    hub._build()
    kamera = next(f for f in hub.funksjoner if f["hash"] == "#kamera")
    assert kamera["aktiv"] and kamera["grunn"] == "camera.inngang"


def _aktive(fakta):
    return {f["hash"]: f["grunn"] for f in KiMshHub._finn_funksjoner(fakta) if f["aktiv"]}


def _f(**kw):
    return {"plattform": None, "klasse": None, "produsent": "", "navn": "", "attributter": set(), "posisjon": False,
            "tilstand": True, **kw}


def test_finn_funksjoner_domener_og_plattformer():
    a = _aktive({
        "light.stue": _f(), "media_player.tv": _f(), "fan.bad": _f(), "vacuum.rolf": _f(),
        "sensor.proxmox_cpu": _f(plattform="proxmoxve"), "sensor.buss": _f(plattform="entur_public_transport"),
    })
    assert a == {"#lys": "light.stue", "#media": "media_player.tv", "#klima": "fan.bad", "#rolf": "vacuum.rolf",
                 "#server": "sensor.proxmox_cpu", "#ruter": "sensor.buss"}


def test_finn_funksjoner_klasse_attributt_posisjon():
    a = _aktive({
        "cover.port": _f(klasse="garage"), "cover.gardin": _f(klasse="curtain"),
        "sensor.restavfall": _f(attributter={"days_to_pickup", "friendly_name"}),
        "person.ola": _f(posisjon=True), "person.kari": _f(),
        "sensor.vannmaler": _f(klasse="water"),
    })
    assert a["#garasje"] == "cover.port"
    assert a["#soppel"] == "sensor.restavfall"
    assert a["#kart"] == "person.ola"
    assert a["#energi"] == "sensor.vannmaler"
    assert "#strom" not in a  # vann er ikke strøm


def test_finn_funksjoner_regex_mot_id_og_navn():
    a = _aktive({
        "switch.ute_1": _f(navn="Vanning plen"),
        "sensor.spisestue_temp": _f(),  # «spa» i «spisestue» er ikke et basseng
        "sensor.nordpool_kwh_no1": _f(),  # «pool» i «nordpool» heller ikke
        "sensor.ams_effekt": _f(klasse="power"),
    })
    assert a["#vanning"] == "switch.ute_1"
    assert "#basseng" not in a
    assert a["#strom"] == "sensor.ams_effekt"
    assert _aktive({"sensor.boblebad_temp": _f()})["#basseng"] == "sensor.boblebad_temp"


def test_finn_funksjoner_produsent():
    assert _aktive({"sensor.p1s_fremdrift": _f(produsent="Bambu Lab P1S")})["#3d-printer"] == "sensor.p1s_fremdrift"
    assert _aktive({"sensor.vp_ute": _f(produsent="NIBE S1255")})["#varmepumpe"] == "sensor.vp_ute"


def test_finn_funksjoner_lister_alle_funksjonene():
    ut = KiMshHub._finn_funksjoner({})
    assert [f["hash"] for f in ut] == [f["hash"] for f in FUNKSJONER]
    assert not any(f["aktiv"] for f in ut)
    # #innstillinger lages bare når noe peker dit (strategien), aldri fra entiteter
    assert not _aktive({"light.x": _f(), "sensor.y": _f(plattform="hassio")}).get("#innstillinger")
