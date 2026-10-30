"""Oppsettsflyt for KI MSH: ett steg (dashbordet), og en meny med Dashbord / Rom / Kort i innstillingene."""

from __future__ import annotations

from typing import Any

import re

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry, ConfigFlow, OptionsFlow
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
    CONF_AREAS, CONF_BUBBLE, CONF_DASHBORD, CONF_EKSKLUDER_ROM, CONF_EXCLUDE, CONF_FUKT_RESERVE, CONF_IKON,
    CONF_INCLUDE_CATEGORY, CONF_INCLUDE_GROUPS, CONF_KUN_ADMIN, CONF_LAGRING, CONF_PRIS, CONF_ROMSENSORER,
    CONF_SIDEPANEL, CONF_TEMP_RESERVE, CONF_TITTEL, CONF_URL, DOMAIN, NAVN, STD_IKON, STD_LAGRING, STD_TITTEL,
    STD_URL, TRACKED_DOMAINS,
)


def _velg(verdier: list[str], nokkel: str) -> selector.SelectSelector:
    return selector.SelectSelector(selector.SelectSelectorConfig(options=verdier, translation_key=nokkel, mode="list"))


def _dash_skjema(d: dict[str, Any]) -> vol.Schema:
    return vol.Schema({
        vol.Optional(CONF_DASHBORD, default=d.get(CONF_DASHBORD, True)): selector.BooleanSelector(),
        vol.Optional(CONF_TITTEL, default=d.get(CONF_TITTEL, STD_TITTEL)): selector.TextSelector(),
        vol.Optional(CONF_URL, default=d.get(CONF_URL, STD_URL)): selector.TextSelector(),
        vol.Optional(CONF_IKON, default=d.get(CONF_IKON, STD_IKON)): selector.IconSelector(),
        vol.Optional(CONF_SIDEPANEL, default=d.get(CONF_SIDEPANEL, True)): selector.BooleanSelector(),
        vol.Optional(CONF_KUN_ADMIN, default=d.get(CONF_KUN_ADMIN, False)): selector.BooleanSelector(),
        vol.Optional(CONF_LAGRING, default=d.get(CONF_LAGRING, STD_LAGRING)): _velg(["felles", "bruker"], CONF_LAGRING),
    })


def _kilder_skjema() -> vol.Schema:
    def ent(dc: str | None = None) -> selector.EntitySelector:
        return selector.EntitySelector(selector.EntitySelectorConfig(domain="sensor", **({"device_class": dc} if dc else {})))
    return vol.Schema({
        vol.Optional(CONF_TEMP_RESERVE): ent("temperature"),
        vol.Optional(CONF_FUKT_RESERVE): ent("humidity"),
        vol.Optional(CONF_PRIS): ent(),
    })


def _rom_skjema() -> vol.Schema:
    return vol.Schema({
        vol.Optional(CONF_ROMSENSORER, default="auto"): _velg(["auto", "alltid", "av"], CONF_ROMSENSORER),
        vol.Optional(CONF_EKSKLUDER_ROM): selector.AreaSelector(selector.AreaSelectorConfig(multiple=True)),
        vol.Optional(CONF_AREAS): selector.AreaSelector(selector.AreaSelectorConfig(multiple=True)),
        vol.Optional(CONF_EXCLUDE): selector.EntitySelector(
            selector.EntitySelectorConfig(multiple=True, domain=list(TRACKED_DOMAINS))),
        vol.Optional(CONF_INCLUDE_CATEGORY, default=False): selector.BooleanSelector(),
        vol.Optional(CONF_INCLUDE_GROUPS, default=False): selector.BooleanSelector(),
    })


def _kort_skjema() -> vol.Schema:
    return vol.Schema({vol.Optional(CONF_BUBBLE, default="auto"): _velg(["auto", "cdn", "av"], CONF_BUBBLE)})


URL_RX = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)+$")


def _ren_url(u: str) -> str:
    """«Mitt Hjem» → «mitt-hjem»; uten bindestrek legges «-dash» til (HA krever bindestrek i dashbord-adresser)."""
    u = re.sub(r"[^a-z0-9]+", "-", (u or STD_URL).strip().strip("/").lower()
               .replace("æ", "ae").replace("ø", "o").replace("å", "a")).strip("-")
    u = u or STD_URL
    return u if "-" in u else u + "-dash"


def _url_feil(hass, u: str, egen: str | None) -> str | None:
    """None = ok, ellers feilnøkkel (ugyldig/opptatt). Egen adresse er alltid ok."""
    if not URL_RX.match(u):
        return "ugyldig"
    if u == egen:
        return None
    paneler = hass.data.get("frontend_panels") or {}
    return "opptatt" if u in paneler else None


class KiMshConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        errors: dict[str, str] = {}
        if user_input is not None:
            user_input[CONF_URL] = _ren_url(user_input.get(CONF_URL))
            if (f := _url_feil(self.hass, user_input[CONF_URL], None)) and user_input.get(CONF_DASHBORD, True):
                errors[CONF_URL] = f
            else:
                return self.async_create_entry(title=NAVN, data={}, options=user_input)
        return self.async_show_form(step_id="user", data_schema=self.add_suggested_values_to_schema(_dash_skjema({}), user_input or {}), errors=errors)

    @staticmethod
    @callback
    def async_get_options_flow(entry: ConfigEntry) -> OptionsFlow:
        return KiMshOptionsFlow(entry)


class KiMshOptionsFlow(OptionsFlow):
    def __init__(self, entry: ConfigEntry) -> None:
        self._entry = entry

    @property
    def _d(self) -> dict[str, Any]:
        return {**self._entry.data, **self._entry.options}

    def _lagre(self, nytt: dict[str, Any], skjema: vol.Schema):
        """Valgfrie felt som er tømt i skjemaet (f.eks. en tom romliste) kommer ikke med i user_input – fjern dem,
        ellers ville den gamle verdien bli stående."""
        d = dict(self._d)
        for nokkel in skjema.schema:
            navn = str(nokkel)
            if navn not in nytt:
                d.pop(navn, None)
        return self.async_create_entry(title="", data={**d, **nytt})

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        return self.async_show_menu(step_id="init", menu_options=["dashbord", "rom", "kilder", "kort"])

    async def async_step_dashbord(self, user_input: dict[str, Any] | None = None):
        errors: dict[str, str] = {}
        if user_input is not None:
            user_input[CONF_URL] = _ren_url(user_input.get(CONF_URL))
            if (f := _url_feil(self.hass, user_input[CONF_URL], self._d.get(CONF_URL))) and user_input.get(CONF_DASHBORD, True):
                errors[CONF_URL] = f
            else:
                return self._lagre(user_input, _dash_skjema(self._d))
        return self.async_show_form(step_id="dashbord", data_schema=_dash_skjema({**self._d, **(user_input or {})}), errors=errors)

    async def async_step_rom(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            return self._lagre(user_input, _rom_skjema())
        return self.async_show_form(step_id="rom", data_schema=self.add_suggested_values_to_schema(_rom_skjema(), self._d))

    async def async_step_kilder(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            return self._lagre(user_input, _kilder_skjema())
        return self.async_show_form(step_id="kilder", data_schema=self.add_suggested_values_to_schema(_kilder_skjema(), self._d))

    async def async_step_kort(self, user_input: dict[str, Any] | None = None):
        if user_input is not None:
            return self._lagre(user_input, _kort_skjema())
        return self.async_show_form(step_id="kort", data_schema=self.add_suggested_values_to_schema(_kort_skjema(), self._d))
