"""Kilder: samler det dashbordet trenger fra søsken-integrasjonene, så frontend slipper å gjette.

- KI Rom (ki_rom): romtellerne per område (sensor.<rom>_oversikt … _effekt), funnet via registeret.
- KI Energi (ki_energi): unique_id «ki_energi_<nøkkel>» → entity_id (også når brukeren har gitt entiteten nytt navn),
  statussensoren og tjenestene som finnes.
- KI Varslinger / andre KI-integrasjoner: brytere (switch.*) per plattform.
- HAs Energi-oppsett: strøm inn/ut, sol, batteri, vann og enheter (statistikk-IDer), pluss strømprissensoren.

Alt er lesing av registre og tilstander – ingen egne tellere. Mangler en integrasjon, er den bare «lastet: false».
"""

from __future__ import annotations

import logging
import re
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

_LOGGER = logging.getLogger(__name__)

KI_ROM = "ki_rom"
KI_ENERGI = "ki_energi"
# Andre KI-integrasjoner med brytere frontend viser (varsler, utelys, planter …)
KI_BRYTERE = ("ki_notifications", "ki_varslinger", "ki_utelys", "ki_planter")
ROM_TYPER = ("oversikt", "lys", "media", "brytere", "sensorer", "effekt")
PRIS_PLATTFORMER = ("nordpool", "tibber", "energidataservice", "strompris", "entsoe")


def _ki_rom(hass: HomeAssistant, reg: er.EntityRegistry) -> dict[str, Any]:
    if not hass.config_entries.async_entries(KI_ROM):
        return {"lastet": False, "rom": {}}
    rom: dict[str, dict[str, str]] = {}
    for e in reg.entities.values():
        if e.platform != KI_ROM or e.disabled or e.domain != "sensor":
            continue
        st = hass.states.get(e.entity_id)
        area = (st.attributes.get("area_id") if st else None) or e.area_id
        typ = next((t for t in ROM_TYPER if e.entity_id.endswith("_" + t) or str(e.unique_id).endswith("_" + t)), None)
        if area and typ:
            rom.setdefault(area, {})[typ] = e.entity_id
    return {"lastet": True, "rom": rom}


def _ki_energi(hass: HomeAssistant, reg: er.EntityRegistry) -> dict[str, Any]:
    if not hass.config_entries.async_entries(KI_ENERGI):
        return {"lastet": False, "entiteter": {}, "status": None, "tjenester": []}
    ent: dict[str, str] = {}
    for e in reg.entities.values():
        if e.platform != KI_ENERGI or e.disabled:
            continue
        uid = str(e.unique_id or "")
        nokkel = uid[len(KI_ENERGI) + 1:] if uid.startswith(KI_ENERGI + "_") else e.entity_id.split(".", 1)[1]
        ent[f"{e.domain}.{nokkel}"] = e.entity_id
    tjenester = sorted(hass.services.async_services_for_domain(KI_ENERGI)) if hasattr(hass.services, "async_services_for_domain") else sorted((hass.services.async_services().get(KI_ENERGI) or {}).keys())
    return {"lastet": True, "entiteter": ent, "status": ent.get("sensor.ki_energi_status") or ent.get("sensor.status"), "tjenester": tjenester}


def _brytere(hass: HomeAssistant, reg: er.EntityRegistry) -> dict[str, Any]:
    ut: dict[str, Any] = {}
    for dom in KI_BRYTERE:
        if not hass.config_entries.async_entries(dom):
            continue
        ut[dom] = sorted(e.entity_id for e in reg.entities.values() if e.platform == dom and e.domain == "switch" and not e.disabled)
    return ut


def _pris(hass: HomeAssistant, reg: er.EntityRegistry) -> str | None:
    kand = [e.entity_id for e in reg.entities.values() if e.platform in PRIS_PLATTFORMER and e.domain == "sensor" and not e.disabled]
    kand.sort(key=lambda x: (not re.search(r"(current|price|pris)", x), x))
    return kand[0] if kand else None


async def _energi(hass: HomeAssistant) -> dict[str, Any]:
    """HAs Energi-oppsett → statistikk-IDer (samme som src/52-energi.js leser selv uten integrasjonen)."""
    try:
        from homeassistant.components.energy.data import async_get_manager  # noqa: PLC0415
        data = (await async_get_manager(hass)).data or {}
    except Exception:  # noqa: BLE001 – Energi ikke satt opp / annen HA-versjon
        return {"lastet": False}
    kilder = data.get("energy_sources") or []
    inn, ut, sol, batt, vann = [], [], [], [], []
    for k in kilder:
        t = k.get("type")
        if t == "grid":
            inn += [f["stat_energy_from"] for f in k.get("flow_from") or [] if f.get("stat_energy_from")]
            ut += [f["stat_energy_to"] for f in k.get("flow_to") or [] if f.get("stat_energy_to")]
            if k.get("stat_energy_from"):
                inn.append(k["stat_energy_from"])
        elif t == "solar" and k.get("stat_energy_from"):
            sol.append(k["stat_energy_from"])
        elif t == "battery" and k.get("stat_energy_from"):
            batt.append(k["stat_energy_from"])
        elif t == "water" and k.get("stat_energy_from"):
            vann.append(k["stat_energy_from"])
    enheter = [{"id": d["stat_consumption"], "navn": d.get("name")} for d in data.get("device_consumption") or [] if d.get("stat_consumption")]
    return {"lastet": bool(kilder or enheter), "inn": inn, "ut": ut, "sol": sol, "batteri": batt, "vann": vann, "enheter": enheter}


async def async_samle(hass: HomeAssistant) -> dict[str, Any]:
    reg = er.async_get(hass)
    kilder = {"ki_rom": _ki_rom(hass, reg), "ki_energi": _ki_energi(hass, reg), "brytere": _brytere(hass, reg)}
    energi = await _energi(hass)
    energi["pris"] = _pris(hass, reg)
    return {"kilder": kilder, "energi": energi}
