"""Det autogenererte dashbordet.

Dashbordet eies av integrasjonen: et Lovelace-panel på /ki-msh (valgfri adresse) med lagret oppsett i
.storage/lovelace.ki_msh. Første gang skrives strategien (custom:ki-dashboard) dit; senere endringer brukeren gjør
(Tilpass, rå konfigurasjon) beholdes. Panelet registreres ved hver oppstart, på samme måte som HAs egne
lagrings-dashbord, så «Rediger dashbord» og lovelace/config/save virker som vanlig.
"""

from __future__ import annotations

import inspect
import logging

from homeassistant.components import frontend as ha_frontend
from homeassistant.components.lovelace import dashboard as ll_dashboard
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback

from .const import (
    CONF_DASHBORD, CONF_IKON, CONF_KUN_ADMIN, CONF_SIDEPANEL, CONF_TITTEL, CONF_URL,
    DOMAIN, STD_IKON, STD_TITTEL, STD_URL, STRATEGI,
)
from .frontend import lovelace_data

_LOGGER = logging.getLogger(__name__)
DASH_ID = "ki_msh"


def _valg(entry: ConfigEntry) -> dict:
    o = {**entry.data, **entry.options}
    return {
        "aktiv": o.get(CONF_DASHBORD, True),
        "url": (o.get(CONF_URL) or STD_URL).strip("/"),
        "tittel": o.get(CONF_TITTEL) or STD_TITTEL,
        "ikon": o.get(CONF_IKON) or STD_IKON,
        "sidepanel": o.get(CONF_SIDEPANEL, True),
        "admin": o.get(CONF_KUN_ADMIN, False),
    }


def _storage(hass: HomeAssistant, v: dict):
    return ll_dashboard.LovelaceStorage(hass, {
        "id": DASH_ID, "url_path": v["url"], "mode": "storage", "title": v["tittel"], "icon": v["ikon"],
        "show_in_sidebar": v["sidepanel"], "require_admin": v["admin"],
    })


def _panel(hass: HomeAssistant, v: dict) -> None:
    """Registrer panelet som HAs egne lagrings-dashbord (lovelace._register_panel).

    show_in_sidebar finnes bare i nyere HA (2025.x+); før det vises panelet i sidepanelet når sidebar_title er satt.
    """
    kw = {
        "frontend_url_path": v["url"], "require_admin": v["admin"], "config": {"mode": "storage"},
        "update": v["url"] in hass.data.get("frontend_panels", {}),
    }
    if "show_in_sidebar" in inspect.signature(ha_frontend.async_register_built_in_panel).parameters:
        kw.update(show_in_sidebar=v["sidepanel"], sidebar_title=v["tittel"], sidebar_icon=v["ikon"])
    elif v["sidepanel"]:
        kw.update(sidebar_title=v["tittel"], sidebar_icon=v["ikon"])
    ha_frontend.async_register_built_in_panel(hass, "lovelace", **kw)


async def async_register(hass: HomeAssistant, entry: ConfigEntry) -> None:
    v = _valg(entry)
    if not v["aktiv"]:
        return
    dashboards, _ = lovelace_data(hass)
    if v["url"] in dashboards and not getattr(dashboards[v["url"]], "_ki_msh", False):
        _LOGGER.warning("KI MSH: /%s er allerede et dashbord – velg en annen adresse i oppsettet", v["url"])
        return
    store = _storage(hass, v)
    store._ki_msh = True  # noqa: SLF001 – merker panelet som vårt
    try:
        lagret = await store.async_load(False)
    except Exception:  # noqa: BLE001 – ConfigNotFound: tomt
        lagret = None
    if not lagret:
        try:
            await store.async_save(dict(STRATEGI))
            _LOGGER.info("KI MSH: lagde dashbordet /%s med strategien custom:ki-dashboard", v["url"])
        except Exception as err:  # noqa: BLE001 – f.eks. gjenopprettingsmodus
            _LOGGER.warning("KI MSH: klarte ikke å lagre dashbordet /%s: %s", v["url"], err)
    dashboards[v["url"]] = store
    _panel(hass, v)
    hass.data.setdefault(DOMAIN + "_dash", {})[entry.entry_id] = v["url"]


@callback
def async_unregister(hass: HomeAssistant, entry: ConfigEntry) -> None:
    url = hass.data.get(DOMAIN + "_dash", {}).pop(entry.entry_id, None)
    if not url:
        return
    dashboards, _ = lovelace_data(hass)
    dashboards.pop(url, None)
    ha_frontend.async_remove_panel(hass, url)


async def async_reset(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Tjenesten ki_msh.lag_dashbord: skriv strategien på nytt (egne endringer i dashbordet forsvinner)."""
    v = _valg(entry)
    await _storage(hass, v).async_save(dict(STRATEGI))
    hass.bus.async_fire("lovelace_updated", {"url_path": v["url"]})


async def async_delete(hass: HomeAssistant, entry: ConfigEntry) -> None:
    try:
        await _storage(hass, _valg(entry)).async_delete()
    except Exception:  # noqa: BLE001
        pass
