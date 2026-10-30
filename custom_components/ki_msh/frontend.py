"""Serverer ki-msh.js fra integrasjonen og laster den på alle sider (add_extra_js_url).

Ligger det fortsatt en gammel Lovelace-ressurs til ki-msh.js (HACS-plugin-utgaven), fjernes den, ellers ville
kortene blitt definert to ganger. Bubble Card lastes fra jsDelivr når den mangler (CONF_BUBBLE = auto).
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path

from homeassistant.components import frontend as ha_frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import BUBBLE_CDN, CONF_BUBBLE, DOMAIN, FRONTEND_FIL, FRONTEND_URL

_LOGGER = logging.getLogger(__name__)
_MAPPE = Path(__file__).parent / "frontend"


def _les_versjon() -> str:
    try:
        return json.loads((Path(__file__).parent / "manifest.json").read_text("utf-8"))["version"]
    except Exception:  # noqa: BLE001
        return "0"


# Leses én gang ved import (HA importerer integrasjoner utenfor hendelsesløkken) – aldri fil-I/O i løkken
_VERSJON = _les_versjon()


def versjon() -> str:
    return _VERSJON


def _innholdshash() -> str:
    """Kort hash av bundelen – byttes ved hver bygging, så nettleser/app aldri bruker en gammel kopi (også uten ny versjon)."""
    try:
        return hashlib.sha1((_MAPPE / FRONTEND_FIL).read_bytes()).hexdigest()[:8]
    except OSError:
        return "0"


async def finnes(hass: HomeAssistant) -> bool:
    """Om frontend/ki-msh.js finnes (sjekkes i en executor – stat er blokkerende I/O)."""
    return await hass.async_add_executor_job((_MAPPE / FRONTEND_FIL).exists)


def lovelace_data(hass: HomeAssistant):
    """(dashboards-dict, resources-samling) – fungerer både med LovelaceData (2025+) og den gamle dict-en."""
    data = hass.data.get("lovelace")
    if data is None:
        return {}, None
    if isinstance(data, dict):
        return data.get("dashboards", {}), data.get("resources")
    return getattr(data, "dashboards", {}), getattr(data, "resources", None)


async def _ressurser(hass: HomeAssistant) -> list[dict]:
    _, res = lovelace_data(hass)
    if res is None:
        return []
    try:
        if hasattr(res, "loaded") and not res.loaded:
            await res.async_load()
            res.loaded = True
        return list(res.async_items())
    except Exception:  # noqa: BLE001
        return []


async def har_ressurs(hass: HomeAssistant, navn: str) -> bool:
    return any(navn in str(r.get("url", "")) for r in await _ressurser(hass))


async def _fjern_gammel_ressurs(hass: HomeAssistant) -> None:
    _, res = lovelace_data(hass)
    if res is None or not hasattr(res, "async_delete_item"):
        return
    for r in await _ressurser(hass):
        url = str(r.get("url", ""))
        if url.split("?")[0].endswith("/" + FRONTEND_FIL) and not url.startswith(FRONTEND_URL):
            try:
                await res.async_delete_item(r["id"])
                _LOGGER.info("KI MSH: fjernet den gamle Lovelace-ressursen %s (lastes nå av integrasjonen)", url)
            except Exception as err:  # noqa: BLE001
                _LOGGER.warning("KI MSH: klarte ikke å fjerne ressursen %s: %s", url, err)


async def async_register(hass: HomeAssistant, entry: ConfigEntry) -> None:
    store = hass.data.setdefault(DOMAIN + "_frontend", {})
    if not store.get("static"):
        if not await finnes(hass):
            _LOGGER.error("KI MSH: %s mangler i integrasjonen – kjør «npm run build»", _MAPPE / FRONTEND_FIL)
            return
        # Statiske stier kan ikke avregistreres – registreres én gang per HA-oppstart (register_static_path er borte i 2025.7)
        await hass.http.async_register_static_paths([StaticPathConfig(FRONTEND_URL, str(_MAPPE), False)])
        store["static"] = True

    await _fjern_gammel_ressurs(hass)
    if not store.get("hash"):
        store["hash"] = await hass.async_add_executor_job(_innholdshash)
    url = f"{FRONTEND_URL}/{FRONTEND_FIL}?v={versjon()}-{store['hash']}"
    if store.get("js") != url:
        if store.get("js"):  # ny versjon uten omstart (lastet på nytt): ikke last begge
            ha_frontend.remove_extra_js_url(hass, store["js"])
        ha_frontend.add_extra_js_url(hass, url)
        store["js"] = url

    valg = {**entry.data, **entry.options}.get(CONF_BUBBLE, "auto")
    trenger_bubble = valg == "cdn" or (valg == "auto" and not await har_ressurs(hass, "bubble-card"))
    if trenger_bubble and not store.get("bubble"):
        ha_frontend.add_extra_js_url(hass, BUBBLE_CDN)
        store["bubble"] = True
    elif not trenger_bubble and store.get("bubble"):  # «Aldri» valgt / Bubble Card installert: ikke last den to ganger
        ha_frontend.remove_extra_js_url(hass, BUBBLE_CDN)
        store["bubble"] = False


def async_unregister(hass: HomeAssistant) -> None:
    """Integrasjonen lastes ut: kortene og Bubble-fra-CDN lastes ikke lenger på nye sider (statiske stier blir stående
    til omstart – HA kan ikke avregistrere dem). hash beholdes ikke, så en ny bundel får ny URL."""
    store = hass.data.get(DOMAIN + "_frontend") or {}
    if store.get("js"):
        ha_frontend.remove_extra_js_url(hass, store.pop("js"))
    if store.pop("bubble", False):
        ha_frontend.remove_extra_js_url(hass, BUBBLE_CDN)
    store.pop("hash", None)
