"""Felles lager for dashbordets oppsett (ki-store) på serveren.

Uten integrasjonen lagrer frontend i HAs user_data (per HA-bruker). Med integrasjonen kan oppsettet være FELLES for alle
brukere og enheter (valget «Lagring» i Konfigurer → Dashbord): én JSON-blob med revisjon. Frontend (src/01-store.js)
bruker ki_msh/lager/* når kommandoen finnes, og laster opp sitt eget oppsett første gang lageret er tomt.

  ki_msh/lager/hent      → { rev, data, modus }
  ki_msh/lager/lagre     { data, rev? } → { rev }   (rev ≠ nåværende → feil «konflikt», frontend henter og fletter)
  ki_msh/lager/abonner   → { rev, data } nå og ved hver endring
"""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store

from .const import DOMAIN

VERSJON = 1
SIGNAL = f"{DOMAIN}_lager"


class Lager:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store = Store(hass, VERSJON, f"{DOMAIN}.oppsett")
        self.rev = 0
        self.data: dict[str, Any] = {}

    async def async_load(self) -> None:
        raw = await self._store.async_load() or {}
        self.rev = int(raw.get("rev") or 0)
        self.data = raw.get("data") or {}

    @callback
    def lagre(self, data: dict[str, Any]) -> int:
        self.data = data
        self.rev += 1
        self._store.async_delay_save(lambda: {"rev": self.rev, "data": self.data}, 1.0)
        async_dispatcher_send(self.hass, SIGNAL)
        return self.rev

    async def async_fjern(self) -> None:
        await self._store.async_remove()


async def async_get(hass: HomeAssistant) -> Lager:
    lager: Lager | None = hass.data.get(DOMAIN + "_lager")
    if lager is None:
        lager = Lager(hass)
        await lager.async_load()
        hass.data[DOMAIN + "_lager"] = lager
    return lager
