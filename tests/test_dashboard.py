"""Dashbordet: strategien lagres bare når lageret er tomt, og brukerens endringer beholdes."""
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.ki_msh import dashboard
from custom_components.ki_msh.const import DOMAIN, STRATEGI
from custom_components.ki_msh.frontend import lovelace_data

NOKKEL = "lovelace.ki_msh"


async def _oppsett(hass, **options):
    assert await async_setup_component(hass, "lovelace", {})
    entry = MockConfigEntry(domain=DOMAIN, data={}, options=options)
    entry.add_to_hass(hass)
    return entry


async def test_tomt_lager_far_strategien(hass, hass_storage):
    entry = await _oppsett(hass)
    await dashboard.async_register(hass, entry)
    assert hass_storage[NOKKEL]["data"]["config"] == STRATEGI
    dashboards, _ = lovelace_data(hass)
    assert "ki-msh" in dashboards
    panel = hass.data["frontend_panels"]["ki-msh"]
    assert panel.component_name == "lovelace" and panel.sidebar_title == "Hjem"


async def test_lagret_dashbord_beholdes(hass, hass_storage):
    eget = {"views": [{"title": "Mitt"}]}
    hass_storage[NOKKEL] = {"version": 1, "minor_version": 1, "key": NOKKEL, "data": {"config": eget}}
    entry = await _oppsett(hass)
    await dashboard.async_register(hass, entry)
    assert hass_storage[NOKKEL]["data"]["config"] == eget
    dashboards, _ = lovelace_data(hass)
    assert await dashboards["ki-msh"].async_load(False) == eget


async def test_ny_oppstart_skriver_ikke_over(hass, hass_storage):
    entry = await _oppsett(hass)
    await dashboard.async_register(hass, entry)
    dashboards, _ = lovelace_data(hass)
    eget = {"strategy": {"type": "custom:ki-dashboard", "popups": {"kamera": False}}}
    await dashboards["ki-msh"].async_save(eget)
    dashboard.async_unregister(hass, entry)
    assert "ki-msh" not in hass.data["frontend_panels"]
    await dashboard.async_register(hass, entry)
    assert hass_storage[NOKKEL]["data"]["config"] == eget


async def test_lag_dashbord_skriver_strategien_pa_nytt(hass, hass_storage):
    entry = await _oppsett(hass)
    await dashboard.async_register(hass, entry)
    dashboards, _ = lovelace_data(hass)
    await dashboards["ki-msh"].async_save({"views": []})
    await dashboard.async_reset(hass, entry)
    assert hass_storage[NOKKEL]["data"]["config"] == STRATEGI


async def test_skjult_i_sidepanelet_og_egen_adresse(hass, hass_storage):
    entry = await _oppsett(hass, url_path="mitt-hjem", sidepanel=False)
    await dashboard.async_register(hass, entry)
    panel = hass.data["frontend_panels"]["mitt-hjem"]
    assert panel.sidebar_title is None or getattr(panel, "show_in_sidebar", True) is False


async def test_adressen_er_opptatt(hass, hass_storage):
    entry = await _oppsett(hass)
    dashboards, _ = lovelace_data(hass)
    dashboards["ki-msh"] = object()  # et dashbord brukeren selv har laget på /ki-msh
    await dashboard.async_register(hass, entry)
    assert NOKKEL not in hass_storage


async def test_av_lager_ikke_dashbord(hass, hass_storage):
    entry = await _oppsett(hass, dashbord=False)
    await dashboard.async_register(hass, entry)
    assert NOKKEL not in hass_storage
