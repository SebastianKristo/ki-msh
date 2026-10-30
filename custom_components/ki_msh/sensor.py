"""Sensorer: sensor.ki_msh (husmodellen) og romtellerne (som KI Rom) når de er slått på."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import UnitOfPower
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, KIND_EFFEKT, KIND_META, KIND_OVERSIKT, KINDS, NAVN, TOTALT_ID, TOTALT_NAVN
from .dashboard import _valg
from .frontend import versjon
from .hub import KiMshHub, signal


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    hub: KiMshHub = hass.data[DOMAIN][entry.entry_id]
    ents: list[SensorEntity] = [KiMshStatus(hub)]
    if hub.romsensorer:
        for area_id, navn in hub.areas.items():
            ents.extend(RomSensor(hub, area_id, navn, k) for k in KINDS)
        ents.extend(RomSensor(hub, TOTALT_ID, TOTALT_NAVN, k) for k in KINDS)
    async_add_entities(ents)


class KiMshStatus(SensorEntity):
    """sensor.ki_msh: tilstand = antall rom. Attributtene er et sammendrag (romnavn, aktive funksjons-popups, rev) –
    hele modellen hentes med websocket ki_msh/hus. Ingenting av det store lagres i databasen (_unrecorded_attributes)."""

    _attr_has_entity_name = False
    _unrecorded_attributes = frozenset({"rom", "popups", "etasjer", "kilder"})
    _attr_should_poll = False
    _attr_icon = "mdi:home-heart"
    _attr_name = NAVN

    def __init__(self, hub: KiMshHub) -> None:
        self._hub = hub
        self._attr_unique_id = f"{hub.entry.entry_id}_status"
        self.entity_id = "sensor.ki_msh"
        self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, hub.entry.entry_id)}, name=NAVN,
                                            manufacturer="KI", model="Dashbord", sw_version=versjon())

    @callback
    def _refresh(self) -> None:
        hus = self._hub.hus()
        v = _valg(self._hub.entry)
        self._attr_native_value = len(hus["rom"])
        k = hus.get("kilder") or {}
        self._attr_extra_state_attributes = {
            "integrasjon": DOMAIN, "versjon": versjon(), "dashbord": f"/{v['url']}" if v["aktiv"] else None,
            "rev": hus["rev"], "romsensorer": hus["romsensorer"],
            "rom": [r["navn"] for r in hus["rom"]], "etasjer": [e["navn"] for e in hus["etasjer"]], "popups": hus["popups"],
            "kilder": sorted([n for n in ("ki_rom", "ki_energi") if (k.get(n) or {}).get("lastet")] + list(k.get("brytere") or {})
                             + (["energi"] if (hus.get("energi") or {}).get("lastet") else [])),
        }

    async def async_added_to_hass(self) -> None:
        # Bare ved endringer i registrene (rom, etasjer, enheter) – ikke ved hver tilstandsendring
        self.async_on_remove(async_dispatcher_connect(self.hass, signal(self._hub.entry.entry_id, "hus"), self._update))
        self._refresh()

    @callback
    def _update(self) -> None:
        self._refresh()
        self.async_write_ha_state()


class RomSensor(SensorEntity):
    """Samme tellere som KI Rom: sensor.<rom>_lys/_media/_brytere/_sensorer/_effekt/_oversikt."""

    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, hub: KiMshHub, area_id: str, area_name: str, kind: str) -> None:
        self._hub, self._area_id, self._area_name, self._kind = hub, area_id, area_name, kind
        meta = KIND_META[kind]
        self._attr_unique_id = f"{hub.entry.entry_id}_{area_id}_{kind}"
        self._attr_name = meta["navn"]
        self._attr_icon = meta["icon"]
        if kind == KIND_EFFEKT:
            self._attr_native_unit_of_measurement = UnitOfPower.WATT
            self._attr_device_class = SensorDeviceClass.POWER
            self._attr_suggested_display_precision = 0
        if kind == KIND_OVERSIKT:
            self._attr_state_class = None
        dev = DeviceInfo(identifiers={(DOMAIN, f"{hub.entry.entry_id}_{area_id}")}, name=area_name,
                         manufacturer=NAVN, model="Romteller", via_device=(DOMAIN, hub.entry.entry_id))
        if area_id != TOTALT_ID:
            dev["suggested_area"] = area_name
        self._attr_device_info = dev
        self._attr_native_value: Any = None
        self._attr_extra_state_attributes: dict[str, Any] = {}

    @callback
    def _refresh(self) -> None:
        r = self._hub.compute(self._area_id, self._kind)
        self._attr_native_value = r["value"]
        self._attr_extra_state_attributes = {"rom": self._area_name, **r["attrs"]}
        if self._kind == KIND_OVERSIKT:
            self._attr_extra_state_attributes["integrasjon"] = "ki_rom"

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(self.hass, signal(self._hub.entry.entry_id, self._area_id), self._update))
        self._refresh()

    @callback
    def _update(self) -> None:
        self._refresh()
        self.async_write_ha_state()
