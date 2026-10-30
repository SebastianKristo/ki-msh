"""Websocket-API for dashbordet.

  ki_msh/hus            → hele husmodellen i ett kall (rom, etasjer, funksjons-popups, kilder, energi, rev)
  ki_msh/hus/abonner    → modellen nå og på nytt hver gang den endres (rom/enheter/integrasjoner) – dashbordet
                          lager popups for nye rom uten omlasting
  ki_msh/lager/*        → felles oppsett for alle brukere (store.py), når «Lagring: felles» er valgt
"""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from . import store
from .const import CONF_LAGRING, DOMAIN, STD_LAGRING
from .frontend import versjon
from .hub import signal


@callback
def async_register(hass: HomeAssistant) -> None:
    if hass.data.get(DOMAIN + "_ws"):
        return
    for cmd in (ws_hus, ws_hus_abonner, ws_lager_hent, ws_lager_lagre, ws_lager_abonner):
        websocket_api.async_register_command(hass, cmd)
    hass.data[DOMAIN + "_ws"] = True


def _hub(hass: HomeAssistant):
    hubs = list(hass.data.get(DOMAIN, {}).values())
    return hubs[0] if hubs else None


def _modell(hass: HomeAssistant, hub) -> dict[str, Any]:
    return {"versjon": versjon(), "lagring": _lagring(hub), **hub.hus()}


def _lagring(hub) -> str:
    return (hub.options.get(CONF_LAGRING) or STD_LAGRING) if hub else "bruker"


@websocket_api.websocket_command({vol.Required("type"): "ki_msh/hus"})
@callback
def ws_hus(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    hub = _hub(hass)
    if hub is None:
        connection.send_error(msg["id"], "not_loaded", "KI MSH er ikke satt opp")
        return
    connection.send_result(msg["id"], _modell(hass, hub))


@websocket_api.websocket_command({vol.Required("type"): "ki_msh/hus/abonner"})
@callback
def ws_hus_abonner(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    hub = _hub(hass)
    if hub is None:
        connection.send_error(msg["id"], "not_loaded", "KI MSH er ikke satt opp")
        return
    sist = {"rev": hub.rev}

    @callback
    def endret() -> None:
        h = _hub(hass)
        if h is None or h.rev == sist["rev"]:
            return
        sist["rev"] = h.rev
        connection.send_message(websocket_api.event_message(msg["id"], _modell(hass, h)))

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, signal(hub.entry.entry_id, "hus"), endret)
    connection.send_result(msg["id"])
    connection.send_message(websocket_api.event_message(msg["id"], _modell(hass, hub)))


@websocket_api.websocket_command({vol.Required("type"): "ki_msh/lager/hent"})
@websocket_api.async_response
async def ws_lager_hent(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    lager = await store.async_get(hass)
    connection.send_result(msg["id"], {"rev": lager.rev, "data": lager.data, "modus": _lagring(_hub(hass))})


@websocket_api.websocket_command({vol.Required("type"): "ki_msh/lager/lagre", vol.Required("data"): dict, vol.Optional("rev"): int})
@websocket_api.async_response
async def ws_lager_lagre(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    lager = await store.async_get(hass)
    if "rev" in msg and msg["rev"] != lager.rev:
        connection.send_error(msg["id"], "konflikt", f"Oppsettet er endret et annet sted (rev {lager.rev})")
        return
    connection.send_result(msg["id"], {"rev": lager.lagre(msg["data"])})


@websocket_api.websocket_command({vol.Required("type"): "ki_msh/lager/abonner"})
@websocket_api.async_response
async def ws_lager_abonner(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    lager = await store.async_get(hass)

    @callback
    def endret() -> None:
        connection.send_message(websocket_api.event_message(msg["id"], {"rev": lager.rev, "data": lager.data}))

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, store.SIGNAL, endret)
    connection.send_result(msg["id"])
    endret()
