"""Tjenester: ki_msh.lag_dashbord (skriv strategien på nytt) og ki_msh.les_rom (kartlegg huset på nytt)."""

from __future__ import annotations

from homeassistant.core import HomeAssistant, ServiceCall, callback

from . import dashboard
from .const import DOMAIN

TJENESTER = ("lag_dashbord", "les_rom")


@callback
def async_register(hass: HomeAssistant) -> None:
    if hass.services.has_service(DOMAIN, "les_rom"):
        return

    async def lag_dashbord(_call: ServiceCall) -> None:
        for hub in hass.data.get(DOMAIN, {}).values():
            await dashboard.async_reset(hass, hub.entry)

    async def les_rom(_call: ServiceCall) -> None:
        for hub in hass.data.get(DOMAIN, {}).values():
            await hub._async_rebuild()  # noqa: SLF001

    hass.services.async_register(DOMAIN, "lag_dashbord", lag_dashbord)
    hass.services.async_register(DOMAIN, "les_rom", les_rom)


@callback
def async_unregister(hass: HomeAssistant) -> None:
    if hass.data.get(DOMAIN):
        return
    for t in TJENESTER:
        hass.services.async_remove(DOMAIN, t)
