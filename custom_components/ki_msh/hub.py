"""Husmodellen: rom, etasjer, entiteter per rom og funksjons-popups.

Romtellerne er en direkte overføring av KI Rom (SebastianKristo/ki-rom, hub.py): samme kartlegging (entitetens
område, ellers enhetens), samme filtre og samme attributter, så dashbordet virker likt med og uten KI Rom.
"""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import Event, HomeAssistant, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.debounce import Debouncer
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_call_later, async_track_state_change_event

try:  # etasjer finnes fra HA 2024.4
    from homeassistant.helpers import floor_registry as fr
except ImportError:  # pragma: no cover
    fr = None

from .const import (
    ACTIVE_BINARY_CLASSES, CONF_AREAS, CONF_EKSKLUDER_ROM, CONF_EXCLUDE, CONF_INCLUDE_CATEGORY,
    CONF_FUKT_RESERVE, CONF_INCLUDE_GROUPS, CONF_PRIS, CONF_TEMP_RESERVE, DOMAIN, FUNKSJONER, KIND_EFFEKT, KIND_META, KIND_OVERSIKT, ROM_MARKOR,
    SENSOR_CLASSES, TOTALT_ID, TRACKED_DOMAINS,
)

_LOGGER = logging.getLogger(__name__)


def signal(entry_id: str, area_id: str) -> str:
    return f"{DOMAIN}_{entry_id}_{area_id}"


class KiMshHub:
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, romsensorer: bool) -> None:
        self.hass = hass
        self.entry = entry
        self.romsensorer = romsensorer
        self.areas: dict[str, str] = {}
        self.area_icons: dict[str, str | None] = {}
        self.area_floors: dict[str, dict[str, Any] | None] = {}
        self.floors: list[dict[str, Any]] = []
        self.members: dict[str, dict[str, list[str]]] = {}
        self.funksjoner: list[dict[str, Any]] = []
        self._entity_area: dict[str, str] = {}
        self._device_of: dict[str, str | None] = {}
        self._class_of: dict[str, str | None] = {}
        self._unsub_state = None
        self._unsub_registry: list = []
        self._known_area_ids: set[str] | None = None
        self._debouncer = Debouncer(hass, _LOGGER, cooldown=2.0, immediate=False, function=self._async_rebuild)
        # Runde 2: husmodellen har revisjon (frontend mellomlagrer på den) og data fra søsken-integrasjonene (kilder.py)
        self.rev = 0
        self.area_extra: dict[str, dict[str, Any]] = {}
        self.samlet: dict[str, Any] = {"kilder": {}, "energi": {"lastet": False}}
        self._totalt_unsub = None

    @property
    def options(self) -> dict[str, Any]:
        return {**self.entry.data, **self.entry.options}

    async def async_start(self) -> None:
        self._build()
        await self._async_samle()
        self.rev = 1
        self._known_area_ids = set(self.areas)
        self._subscribe_states()
        events = [ar.EVENT_AREA_REGISTRY_UPDATED, er.EVENT_ENTITY_REGISTRY_UPDATED, dr.EVENT_DEVICE_REGISTRY_UPDATED]
        if fr is not None and hasattr(fr, "EVENT_FLOOR_REGISTRY_UPDATED"):
            events.append(fr.EVENT_FLOOR_REGISTRY_UPDATED)
        for ev in events:
            self._unsub_registry.append(self.hass.bus.async_listen(ev, self._registry_changed))
        # KI Rom / KI Energi / Energi legges til eller fjernes → ny modell (og romtellerne vurderes på nytt)
        try:
            from homeassistant.config_entries import SIGNAL_CONFIG_ENTRY_CHANGED  # noqa: PLC0415
            from homeassistant.helpers.dispatcher import async_dispatcher_connect  # noqa: PLC0415
            self._unsub_registry.append(async_dispatcher_connect(self.hass, SIGNAL_CONFIG_ENTRY_CHANGED, self._entry_changed))
        except ImportError:  # pragma: no cover
            pass

    @callback
    def async_stop(self) -> None:
        if self._unsub_state:
            self._unsub_state()
            self._unsub_state = None
        for unsub in self._unsub_registry:
            unsub()
        self._unsub_registry = []
        self._debouncer.async_cancel()
        if self._totalt_unsub:
            self._totalt_unsub()
            self._totalt_unsub = None

    @callback
    def _registry_changed(self, _event: Event) -> None:
        self._debouncer.async_schedule_call()

    @callback
    def _entry_changed(self, _change: Any, entry: ConfigEntry) -> None:
        if entry.domain == DOMAIN:
            return
        if entry.domain == ROM_MARKOR:
            from . import bruk_romsensorer  # noqa: PLC0415
            if bruk_romsensorer(self.hass, self.entry) != self.romsensorer:
                _LOGGER.info("KI MSH: KI Rom lagt til/fjernet – romtellerne vurderes på nytt")
                self.hass.config_entries.async_schedule_reload(self.entry.entry_id)
                return
        self._debouncer.async_schedule_call()

    async def _async_samle(self) -> None:
        from .kilder import async_samle  # noqa: PLC0415
        try:
            self.samlet = await async_samle(self.hass)
        except Exception:  # noqa: BLE001 – kildene er bonus, aldri en grunn til å feile
            _LOGGER.exception("KI MSH: kunne ikke lese søsken-integrasjonene")

    async def async_rebuild(self) -> None:
        await self._async_rebuild()

    async def _async_rebuild(self) -> None:
        self._build()
        await self._async_samle()
        self.rev += 1
        new_ids = set(self.areas)
        if self.romsensorer and self._known_area_ids is not None and new_ids != self._known_area_ids:
            _LOGGER.info("KI MSH: rom endret, laster på nytt")
            self._known_area_ids = new_ids
            self.hass.config_entries.async_schedule_reload(self.entry.entry_id)
            return
        self._known_area_ids = new_ids
        self._subscribe_states()
        self._notify_all()

    # ------------------------------------------------------------------ kartlegging
    def _build(self) -> None:
        area_reg, ent_reg, dev_reg = ar.async_get(self.hass), er.async_get(self.hass), dr.async_get(self.hass)
        wanted = set(self.options.get(CONF_AREAS) or [])
        skip = set(self.options.get(CONF_EKSKLUDER_ROM) or [])
        excluded = set(self.options.get(CONF_EXCLUDE) or [])
        include_category = bool(self.options.get(CONF_INCLUDE_CATEGORY, False))
        include_groups = bool(self.options.get(CONF_INCLUDE_GROUPS, False))

        floors: dict[str, dict[str, Any]] = {}
        if fr is not None:
            try:
                for f in fr.async_get(self.hass).async_list_floors():
                    floors[f.floor_id] = {"id": f.floor_id, "navn": f.name, "niva": f.level, "ikon": f.icon}
            except Exception:  # noqa: BLE001
                floors = {}

        areas, icons, area_floors, extra = {}, {}, {}, {}
        for area in area_reg.async_list_areas():
            if (wanted and area.id not in wanted) or area.id in skip:
                continue
            areas[area.id] = area.name
            icons[area.id] = area.icon
            extra[area.id] = {
                "bilde": getattr(area, "picture", None),
                "aliaser": sorted(getattr(area, "aliases", None) or []),
                # HAs egne klimasensorer for området (HA 2024.11+), ellers None
                "temperatur_entity": getattr(area, "temperature_entity_id", None),
                "fuktighet_entity": getattr(area, "humidity_entity_id", None),
            }
            area_floors[area.id] = floors.get(getattr(area, "floor_id", None))

        members: dict[str, dict[str, list[str]]] = {aid: defaultdict(list) for aid in areas}
        device_of, class_of = {}, {}
        fakta: dict[str, dict[str, Any]] = {}  # entitet → det funksjons-popupene ser på (_finn_funksjoner)

        for e in ent_reg.entities.values():
            if e.disabled or e.platform in (DOMAIN, ROM_MARKOR):
                continue
            dev = dev_reg.async_get(e.device_id) if e.device_id else None
            fakta[e.entity_id] = {
                "plattform": e.platform, "klasse": e.device_class or e.original_device_class,
                "produsent": " ".join(str(x) for x in (dev.manufacturer, dev.model, dev.name) if x) if dev else "",
            }
            if e.domain not in TRACKED_DOMAINS or e.hidden or e.entity_id in excluded:
                continue
            if e.entity_category is not None and not include_category:
                continue
            if e.platform == "group" and not include_groups and e.domain != "cover":
                continue
            area_id = e.area_id
            if not area_id and dev:
                area_id = dev.area_id
            if not area_id or area_id not in members:
                continue
            dc = e.device_class or e.original_device_class
            if e.domain == "sensor" and dc not in SENSOR_CLASSES:
                continue
            if e.domain == "binary_sensor" and dc not in ACTIVE_BINARY_CLASSES:
                continue
            members[area_id][e.domain].append(e.entity_id)
            device_of[e.entity_id] = e.device_id
            class_of[e.entity_id] = str(dc) if dc else None

        # Tilstanden gir navn, attributter og device_class – også for entiteter uten registeroppføring (YAML/templates)
        for st in self.hass.states.async_all():
            f = fakta.get(st.entity_id)
            if f is None:
                if (reg := ent_reg.async_get(st.entity_id)) is not None and (reg.disabled or reg.platform in (DOMAIN, ROM_MARKOR)):
                    continue
                f = fakta[st.entity_id] = {"plattform": None, "klasse": None, "produsent": ""}
            f["navn"] = str(st.attributes.get("friendly_name") or "")
            f["klasse"] = f["klasse"] or st.attributes.get("device_class")
            f["attributter"] = set(st.attributes)
            f["posisjon"] = st.attributes.get("latitude") is not None
            f["tilstand"] = True

        for domains in members.values():
            for lst in domains.values():
                lst.sort()

        self.areas = dict(sorted(areas.items(), key=lambda kv: kv[1].lower()))
        self.area_icons, self.area_floors, self.members = icons, area_floors, members
        self.area_extra = extra
        self.floors = sorted(floors.values(), key=lambda f: (f.get("niva") is None, f.get("niva") or 0))
        self._device_of, self._class_of = device_of, class_of
        self._entity_area = {eid: aid for aid, ds in members.items() for lst in ds.values() for eid in lst}
        # Bare entiteter som finnes nå (har tilstand), som i strategien
        self.funksjoner = self._finn_funksjoner({eid: f for eid, f in fakta.items() if f.get("tilstand")})

    @staticmethod
    def _treffer(regel: dict[str, Any], eid: str, f: dict[str, Any]) -> bool:
        def en_av(verdi: Any, faktisk: Any) -> bool:
            return faktisk in (verdi if isinstance(verdi, tuple) else (verdi,))

        if "domene" in regel and not en_av(regel["domene"], eid.split(".", 1)[0]):
            return False
        if "plattform" in regel and not en_av(regel["plattform"], f.get("plattform")):
            return False
        if "klasse" in regel and not en_av(regel["klasse"], str(f.get("klasse") or "") or None):
            return False
        if "produsent" in regel and not re.search(regel["produsent"], f.get("produsent") or "", re.I):
            return False
        if "attributt" in regel and regel["attributt"] not in f.get("attributter", ()):
            return False
        if regel.get("posisjon") and not f.get("posisjon"):
            return False
        if "rx" in regel:
            r = re.compile(regel["rx"])
            if not (r.search(eid) or r.search((f.get("navn") or "").lower())):
                return False
        return True

    @classmethod
    def _finn_funksjoner(cls, fakta: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
        """Hvilke funksjons-popups huset har (FUNKSJONER i const.py). grunn = første entitet som traff."""
        ut = []
        for fn in FUNKSJONER:
            grunn = next((eid for regel in fn["regler"] for eid, f in sorted(fakta.items())
                          if cls._treffer(regel, eid, f)), None)
            ut.append({"hash": fn["hash"], "navn": fn["navn"], "aktiv": bool(grunn), "grunn": grunn})
        return ut

    def _subscribe_states(self) -> None:
        if self._unsub_state:
            self._unsub_state()
            self._unsub_state = None
        ids = sorted(self._entity_area)
        if ids and self.romsensorer:
            self._unsub_state = async_track_state_change_event(self.hass, ids, self._state_changed)

    @callback
    def _state_changed(self, event: Event) -> None:
        area_id = self._entity_area.get(event.data.get("entity_id"))
        if area_id:
            async_dispatcher_send(self.hass, signal(self.entry.entry_id, area_id))
        # «Hele huset» regner over alle entiteter – samles opp til én oppdatering per sekund (tunge hus)
        if self._totalt_unsub is None:
            self._totalt_unsub = async_call_later(self.hass, 1.0, self._totalt_nå)

    @callback
    def _totalt_nå(self, _now: Any) -> None:
        self._totalt_unsub = None
        async_dispatcher_send(self.hass, signal(self.entry.entry_id, TOTALT_ID))

    @callback
    def _notify_all(self) -> None:
        for area_id in [*self.areas, TOTALT_ID, "hus"]:
            async_dispatcher_send(self.hass, signal(self.entry.entry_id, area_id))

    # ------------------------------------------------------------------ oppslag
    def entity_ids(self, area_id: str | None, domain: str) -> list[str]:
        if area_id in (None, TOTALT_ID):
            return sorted(e for ds in self.members.values() for e in ds.get(domain, []))
        return list(self.members.get(area_id, {}).get(domain, []))

    def sensors_of_class(self, area_id: str | None, device_class: str) -> list[str]:
        return [e for e in self.entity_ids(area_id, "sensor") if self._class_of.get(e) == device_class]

    def _navn(self, entity_id: str) -> str:
        st = self.hass.states.get(entity_id)
        return (st.attributes.get("friendly_name") if st else None) or entity_id

    def compute(self, area_id: str | None, kind: str) -> dict[str, Any]:
        if kind == KIND_OVERSIKT:
            return self._compute_oversikt(area_id)
        if kind == KIND_EFFEKT:
            return self._compute_effekt(self.sensors_of_class(area_id, "power"))
        meta = KIND_META[kind]
        ids = self.entity_ids(area_id, meta["domain"])
        aktiv, inaktiv, borte = [], [], []
        for eid in ids:
            st = self.hass.states.get(eid)
            if st is None or st.state in ("unavailable", "unknown"):
                borte.append(eid)
            elif st.state in meta["aktiv_states"]:
                aktiv.append(eid)
            else:
                inaktiv.append(eid)
        return {"value": len(aktiv), "attrs": {
            "totalt": len(ids), "aktiv": len(aktiv), "inaktiv": len(inaktiv), "utilgjengelig": len(borte),
            "tekst": f"{len(aktiv)} {meta['ord_aktiv']} - {len(inaktiv)} {meta['ord_inaktiv']}",
            "aktiv_liste": aktiv, "inaktiv_liste": inaktiv, "utilgjengelig_liste": borte,
            "aktiv_navn": [self._navn(e) for e in aktiv], "entiteter": ids,
        }}

    def _compute_effekt(self, ids: list[str]) -> dict[str, Any]:
        total, per = 0.0, {}
        for eid in ids:
            st = self.hass.states.get(eid)
            if st is None or st.state in ("unavailable", "unknown", ""):
                continue
            try:
                val = float(st.state)
            except (TypeError, ValueError):
                continue
            unit = (st.attributes.get("unit_of_measurement") or "W").strip().lower()
            val = val * 1000.0 if unit == "kw" else val / 1000.0 if unit == "mw" else val
            per[eid] = round(val, 1)
            total += val
        total = round(total, 1)
        return {"value": total, "attrs": {"tekst": f"{total:.0f} W", "kilder": per, "entiteter": ids}}

    def _linked_power(self, area_id: str | None, entity_id: str) -> str | None:
        dev = self._device_of.get(entity_id)
        if not dev:
            return None
        return next((s for s in self.sensors_of_class(area_id, "power") if self._device_of.get(s) == dev), None)

    def _compute_oversikt(self, area_id: str | None) -> dict[str, Any]:
        aid = area_id or TOTALT_ID
        power_all = self.sensors_of_class(area_id, "power")

        def with_power(ids: list[str]) -> list[dict[str, Any]]:
            return [{"entity": e, "effekt": self._linked_power(area_id, e)} for e in ids]

        brytere = with_power(self.entity_ids(area_id, "switch"))
        klima = with_power(self.entity_ids(area_id, "climate"))
        vifter = with_power(self.entity_ids(area_id, "fan"))
        brukt = {d["effekt"] for d in brytere + klima + vifter if d["effekt"]}
        lys, media, gardiner = (self.entity_ids(area_id, d) for d in ("light", "media_player", "cover"))
        sensorer = [{"entity": e, "klasse": self._class_of.get(e)} for e in self.entity_ids(area_id, "binary_sensor")]
        floor = self.area_floors.get(aid) or {}
        attrs = {
            "integrasjon": ROM_MARKOR, "kilde": DOMAIN, "area_id": aid, "ikon": self.area_icons.get(aid),
            "etasje": floor.get("navn"), "etasje_id": floor.get("id"), "etasje_niva": floor.get("niva"),
            "lys": lys, "media": media, "brytere": brytere, "vifter": vifter, "klima": klima, "gardiner": gardiner,
            "sensorer": sensorer, "skript": self.entity_ids(area_id, "script"), "scener": self.entity_ids(area_id, "scene"),
            "temperatur": self.sensors_of_class(area_id, "temperature"),
            "fuktighet": self.sensors_of_class(area_id, "humidity"),
            "lysniva": self.sensors_of_class(area_id, "illuminance"),
            "effekt": power_all, "effekt_andre": [e for e in power_all if e not in brukt],
        }
        total = len(lys) + len(media) + len(brytere) + len(vifter) + len(klima) + len(gardiner) + len(sensorer)
        return {"value": total, "attrs": attrs}

    # ------------------------------------------------------------------ hele huset (sensor.ki_msh / ki_msh/hus)
    def hus(self) -> dict[str, Any]:
        """Hele husmodellen (websocket ki_msh/hus). Rommene er de som er valgt i Konfigurer → Rom (areas/ekskluder_rom),
        med listene fra KI Rom-kartleggingen. rev øker ved hver ny modell; kilder/energi kommer fra kilder.py."""
        kirom = ((self.samlet.get("kilder") or {}).get("ki_rom") or {}).get("rom") or {}
        rom = []
        for aid, navn in self.areas.items():
            o = self._compute_oversikt(aid)
            f = self.area_floors.get(aid) or {}
            x = self.area_extra.get(aid) or {}
            a = o["attrs"]
            rom.append({
                "area_id": aid, "navn": navn, "ikon": self.area_icons.get(aid), "etasje_id": f.get("id"),
                "bilde": x.get("bilde"), "aliaser": x.get("aliaser") or [],
                "antall": o["value"],
                **{k: a[k] for k in ("lys", "media", "klima", "gardiner", "temperatur", "fuktighet", "effekt", "effekt_andre", "scener", "skript", "lysniva")},
                "brytere": [d["entity"] for d in a["brytere"]], "vifter": [d["entity"] for d in a["vifter"]],
                "sensorer": a["sensorer"],
                # Beste klimasensor: HAs eget valg for området, ellers første i rommet
                "temperatur_entity": x.get("temperatur_entity") or (a["temperatur"][0] if a["temperatur"] else None),
                "fuktighet_entity": x.get("fuktighet_entity") or (a["fuktighet"][0] if a["fuktighet"] else None),
                "ki_rom": kirom.get(aid) or {},
            })
        return {
            "rev": self.rev,
            "etasjer": self.floors, "rom": rom, "funksjoner": self.funksjoner,
            "popups": [f["hash"] for f in self.funksjoner if f["aktiv"]],
            "romsensorer": "ki_msh" if self.romsensorer else ("ki_rom" if self.hass.config_entries.async_entries(ROM_MARKOR) else "av"),
            "kilder": self.samlet.get("kilder") or {},
            "energi": {**(self.samlet.get("energi") or {"lastet": False}), **({"pris": self.options[CONF_PRIS]} if self.options.get(CONF_PRIS) else {})},
            # Reserve for hus/rom uten egen sensor (Konfigurer → Kilder) – erstatter gjettede ID-er i frontend
            "reserve": {"temperatur": self.options.get(CONF_TEMP_RESERVE), "fuktighet": self.options.get(CONF_FUKT_RESERVE)},
        }
