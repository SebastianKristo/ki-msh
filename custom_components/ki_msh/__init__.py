"""KI MSH – dashbordet som integrasjon.

Når integrasjonen legges til:
- serveres kortene (frontend/ki-msh.js) fra integrasjonen og lastes på alle sider – ingen Lovelace-ressurs å legge inn;
- lages dashbordet automatisk (/ki-msh, strategien custom:ki-dashboard) og vises i sidepanelet;
- lages romtellerne som KI Rom gir (sensor.<rom>_lys … _oversikt), med mindre KI Rom allerede er installert;
- sensor.ki_msh og websocket-kommandoen ki_msh/hus gir hele husmodellen (rom, etasjer, funksjons-popups).
"""

from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from . import dashboard, frontend, repairs, services, websocket
from .const import CONF_ROMSENSORER, DOMAIN, ROM_MARKOR
from .hub import KiMshHub

_LOGGER = logging.getLogger(__name__)
PLATFORMS: list[Platform] = [Platform.SENSOR]


def bruk_romsensorer(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    valg = {**entry.data, **entry.options}.get(CONF_ROMSENSORER, "auto")
    if valg == "av":
        return False
    if valg == "alltid":
        return True
    return not hass.config_entries.async_entries(ROM_MARKOR)


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hub = KiMshHub(hass, entry, romsensorer=bruk_romsensorer(hass, entry))
    await hub.async_start()
    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = hub

    await frontend.async_register(hass, entry)
    await dashboard.async_register(hass, entry)
    await repairs.async_check(hass, entry)
    websocket.async_register(hass)
    services.async_register(hass)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_oppdatert))
    return True


async def _oppdatert(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if ok:
        hub: KiMshHub = hass.data[DOMAIN].pop(entry.entry_id)
        hub.async_stop()
        dashboard.async_unregister(hass, entry)
        services.async_unregister(hass)
    return ok


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Integrasjonen fjernes helt: dashbordets lagrede oppsett slettes også."""
    await dashboard.async_delete(hass, entry)
