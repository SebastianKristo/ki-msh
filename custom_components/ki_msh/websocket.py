"""Websocket: ki_msh/hus gir hele husmodellen i ett kall (rom, etasjer, funksjons-popups, romsensorkilde)."""

from __future__ import annotations

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN
from .frontend import versjon


@callback
def async_register(hass: HomeAssistant) -> None:
    if hass.data.get(DOMAIN + "_ws"):
        return
    websocket_api.async_register_command(hass, ws_hus)
    hass.data[DOMAIN + "_ws"] = True


@websocket_api.websocket_command({vol.Required("type"): "ki_msh/hus"})
@callback
def ws_hus(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    hubs = list(hass.data.get(DOMAIN, {}).values())
    if not hubs:
        connection.send_error(msg["id"], "not_loaded", "KI MSH er ikke satt opp")
        return
    connection.send_result(msg["id"], {"versjon": versjon(), **hubs[0].hus()})
