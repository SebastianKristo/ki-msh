"""Reparasjoner: varsler i Innstillinger → Reparasjoner når noe dashbordet trenger mangler."""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir

from .const import CONF_BUBBLE, DOMAIN
from .frontend import finnes, har_ressurs


async def async_check(hass: HomeAssistant, entry: ConfigEntry) -> None:
    valg = {**entry.data, **entry.options}.get(CONF_BUBBLE, "auto")
    if valg == "av" and not await har_ressurs(hass, "bubble-card"):
        ir.async_create_issue(hass, DOMAIN, "bubble_mangler", is_fixable=False, severity=ir.IssueSeverity.WARNING,
                              translation_key="bubble_mangler", learn_more_url="https://github.com/Clooos/Bubble-Card")
    else:
        ir.async_delete_issue(hass, DOMAIN, "bubble_mangler")
    if not await finnes(hass):
        ir.async_create_issue(hass, DOMAIN, "frontend_mangler", is_fixable=False, severity=ir.IssueSeverity.ERROR,
                              translation_key="frontend_mangler")
    else:
        ir.async_delete_issue(hass, DOMAIN, "frontend_mangler")
