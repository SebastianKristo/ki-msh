"""Romtellerne (sensor.<rom>_lys …) lages bare når KI Rom ikke er satt opp (romsensorer: auto)."""
from homeassistant.helpers import area_registry as ar
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.ki_msh import bruk_romsensorer, sensor
from custom_components.ki_msh.const import DOMAIN, KINDS
from custom_components.ki_msh.hub import KiMshHub


async def _sensorer(hass, entry):
    hub = KiMshHub(hass, entry, romsensorer=bruk_romsensorer(hass, entry))
    hub._build()
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = hub
    laget = []
    await sensor.async_setup_entry(hass, entry, lambda ents: laget.extend(ents))
    return hub, laget


def _entry(hass, **options):
    e = MockConfigEntry(domain=DOMAIN, data={}, options=options)
    e.add_to_hass(hass)
    return e


async def test_auto_uten_ki_rom_lager_romtellere(hass):
    ar.async_get(hass).async_create("Stue")
    hub, laget = await _sensorer(hass, _entry(hass))
    assert hub.romsensorer
    rom = [s for s in laget if isinstance(s, sensor.RomSensor)]
    assert len(rom) == 2 * len(KINDS)  # Stue + Hele huset
    assert any(isinstance(s, sensor.KiMshStatus) for s in laget)


async def test_auto_med_ki_rom_lager_ingen_romtellere(hass):
    ar.async_get(hass).async_create("Stue")
    MockConfigEntry(domain="ki_rom", data={}).add_to_hass(hass)
    hub, laget = await _sensorer(hass, _entry(hass))
    assert not hub.romsensorer
    assert not [s for s in laget if isinstance(s, sensor.RomSensor)]
    assert [type(s) for s in laget] == [sensor.KiMshStatus]  # sensor.ki_msh finnes alltid
    assert hub.hus()["romsensorer"] == "ki_rom"


async def test_alltid_og_av(hass):
    ar.async_get(hass).async_create("Stue")
    MockConfigEntry(domain="ki_rom", data={}).add_to_hass(hass)
    assert bruk_romsensorer(hass, _entry(hass, romsensorer="alltid"))
    assert not bruk_romsensorer(hass, _entry(hass, romsensorer="av"))
