"""Runde 2: URL-validering, tømming av lister i innstillingene, KI Energi-kilden, felles lager og husmodellen via websocket."""
from unittest.mock import patch

import pytest
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.ki_msh import store
from custom_components.ki_msh.config_flow import _ren_url, _url_feil
from custom_components.ki_msh.const import CONF_AREAS, CONF_EKSKLUDER_ROM, DOMAIN
from custom_components.ki_msh.hub import KiMshHub
from custom_components.ki_msh.kilder import async_samle


def test_ren_url():
    assert _ren_url("Mitt Hjem") == "mitt-hjem"
    assert _ren_url("/hjem/") == "hjem-dash"
    assert _ren_url("Hytta på fjellet") == "hytta-pa-fjellet"
    assert _ren_url("") == "ki-msh"


async def test_url_feil(hass):
    hass.data["frontend_panels"] = {"energy-dash": object()}
    assert _url_feil(hass, "mitt hjem", None) == "ugyldig"
    assert _url_feil(hass, "energy-dash", None) == "opptatt"
    assert _url_feil(hass, "energy-dash", "energy-dash") is None  # egen adresse
    assert _url_feil(hass, "ki-msh", None) is None


@pytest.fixture
def uten_frontend(hass):
    """HAs frontend (hass_frontend) finnes ikke i testmiljøet: regn den og lovelace som lastet, og hopp over JS-registreringen."""
    hass.config.components.update({"frontend", "lovelace"})
    with patch("custom_components.ki_msh.frontend.async_register"), patch("custom_components.ki_msh.dashboard.async_register"), \
            patch("custom_components.ki_msh.repairs.async_check"):
        yield


async def test_tomme_lister_fjernes(hass, uten_frontend):
    entry = MockConfigEntry(domain=DOMAIN, data={}, options={CONF_AREAS: ["stue"], CONF_EKSKLUDER_ROM: ["bad"]})
    entry.add_to_hass(hass)
    flow = await hass.config_entries.options.async_init(entry.entry_id)
    flow = await hass.config_entries.options.async_configure(flow["flow_id"], {"next_step_id": "rom"})
    res = await hass.config_entries.options.async_configure(flow["flow_id"], {"romsensorer": "av"})
    assert res["type"] == "create_entry"
    assert CONF_AREAS not in res["data"] and CONF_EKSKLUDER_ROM not in res["data"]
    assert res["data"]["romsensorer"] == "av"


async def test_ki_energi_unique_id_kart(hass):
    MockConfigEntry(domain="ki_energi").add_to_hass(hass)
    reg = er.async_get(hass)
    # brukeren har gitt statussensoren nytt navn – unique_id peker fortsatt riktig
    reg.async_get_or_create("sensor", "ki_energi", "ki_energi_ki_energi_status", suggested_object_id="mitt_energistatus")  # unique_id = ki_energi_<nøkkel>
    S = await async_samle(hass)
    ke = S["kilder"]["ki_energi"]
    assert ke["lastet"] and ke["status"] == "sensor.mitt_energistatus"
    assert ke["entiteter"]["sensor.ki_energi_status"] == "sensor.mitt_energistatus"
    assert S["kilder"]["ki_rom"]["lastet"] is False


async def test_felles_lager(hass, hass_storage):
    lager = await store.async_get(hass)
    assert lager.rev == 0 and lager.data == {}
    assert lager.lagre({"cards": {"ki-home": {"x": 1}}}) == 1
    assert lager.lagre({"cards": {}}) == 2


async def test_husmodell_websocket(hass, hass_ws_client, uten_frontend):
    ar.async_get(hass).async_create("Stue")
    entry = MockConfigEntry(domain=DOMAIN, data={}, options={"dashbord": False, "romsensorer": "av"})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    ws = await hass_ws_client(hass)
    await ws.send_json({"id": 1, "type": "ki_msh/hus"})
    r = await ws.receive_json()
    assert r["success"]
    m = r["result"]
    assert m["rev"] >= 1 and m["lagring"] == "felles"
    assert [x["navn"] for x in m["rom"]] == ["Stue"]
    assert {"kilder", "energi", "reserve", "funksjoner"} <= set(m)
    # felles lager over websocket, med konflikt på gammel revisjon
    await ws.send_json({"id": 2, "type": "ki_msh/lager/lagre", "data": {"a": 1}})
    r = await ws.receive_json()
    assert r["success"] and r["result"]["rev"] == 1
    await ws.send_json({"id": 3, "type": "ki_msh/lager/lagre", "data": {"a": 2}, "rev": 0})
    r = await ws.receive_json()
    assert not r["success"] and r["error"]["code"] == "konflikt"
    await ws.send_json({"id": 4, "type": "ki_msh/lager/hent"})
    r = await ws.receive_json()
    assert r["result"]["data"] == {"a": 1}
    # velkomstmeldingen vises én gang
    assert entry.data.get("velkommen_vist") is True
    hub: KiMshHub = hass.data[DOMAIN][entry.entry_id]
    assert len(str(hass.states.get("sensor.ki_msh").attributes)) < 16000 and hub.rev >= 1
