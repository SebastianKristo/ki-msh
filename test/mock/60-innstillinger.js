// Testdata for Innstillinger (#settings, msh-innstillinger-card, fiks 25.5/26.15): toppkortet (brukerens ki-natt-card-entiteter:
// switch.nattmodus, input_boolean.innendors_privace_mode, sensor.soverom_vekking_neste_alarm) og KI Varslinger og sikkerhet
// (ki_notifications: 12 regler = 12 enheter, flere brytere per regel der hovedbryteren velges med erMaster). KI Energi
// (varslingsbryterne) kommer fra 42-klimaz-blokker; KI Utelys (43-utelys) får plattform og enhet her. Fiks 27: kategoriene
// Kamera (to regler) og Klima (én) + input_boolean.varsel_dor_last. Bare test.
(function () {
  window.mockExtend(({ add, E, D }) => {
    const next = new Date(Date.now() + 8 * 3600e3); next.setHours(6, 45, 0, 0);
    add('switch.nattmodus', 'off', { friendly_name: 'Nattmodus', icon: 'mdi:power-sleep' });
    add('input_boolean.innendors_privace_mode', 'on', { friendly_name: 'Innendørs privacy mode', icon: 'mdi:cctv-off' });
    add('sensor.soverom_vekking_neste_alarm', next.toISOString(), { friendly_name: 'Soverom vekking neste alarm', device_class: 'timestamp' });
    const dev = (id, name, model) => { D[id] = { id, name, name_by_user: null, model: model || 'Regel', manufacturer: 'KI', entry_type: 'service', config_entries: ['ce_' + id], area_id: null }; };
    const N = (id, st, name, d) => add(id, st, { friendly_name: name }, { platform: 'ki_notifications', device: d });
    dev('n_vekking', 'Vekking'); N('switch.vekking_aktivert', 'on', 'Vekking - Aktivert', 'n_vekking'); N('switch.vekking_lyd', 'on', 'Vekking - Lyd', 'n_vekking');
    dev('n_ansikt', 'Ansiktsgjenkjenning'); N('switch.ansiktsgjenkjenning_aktivert', 'on', 'Ansiktsgjenkjenning - Aktivert', 'n_ansikt'); N('switch.ansiktsgjenkjenning_varsle', 'off', 'Ansiktsgjenkjenning - Varsle ukjent', 'n_ansikt');
    dev('n_autolas', 'Autolås'); N('switch.autolas_autolas', 'on', 'Autolås Autolås', 'n_autolas');
    dev('n_fastkjort', 'Dørlås fastkjørt'); N('switch.dorlas_fastkjort_varsling', 'on', 'Dørlås fastkjørt - Varsling', 'n_fastkjort');
    dev('n_dorlys', 'Dørlys'); N('switch.dorlys_blink_aktiv', 'off', 'Dørlys - Blink', 'n_dorlys');
    dev('n_heimdall', 'Heimdall'); N('switch.heimdall', 'on', 'Heimdall', 'n_heimdall');
    dev('n_alarm', 'Alarm'); N('switch.alarm_alle_varsler', 'on', 'Alarm - Alle varsler', 'n_alarm'); N('switch.alarm_ved_apning', 'on', 'Alarm - Ved åpning', 'n_alarm'); N('switch.alarm_sirene', 'off', 'Alarm - Sirene', 'n_alarm');
    dev('n_familie', 'Familie - hjemme/borte'); N('switch.familie_alle_varsler', 'on', 'Familie - Alle varsler', 'n_familie'); N('switch.familie_sebastian', 'on', 'Familie - Sebastian', 'n_familie');
    dev('n_ruter', 'Ruter - fra skolen'); N('switch.ruter_fra_skolen_aktivert', 'off', 'Ruter - fra skolen - Aktivert', 'n_ruter');
    dev('n_planter', 'Planter'); N('switch.planter_varsling', 'on', 'Planter - Varsling', 'n_planter');
    dev('n_stovsuger', 'Støvsuger'); N('switch.stovsuger_feil', 'on', 'Støvsuger - Feil', 'n_stovsuger'); N('switch.stovsuger_ferdig', 'on', 'Støvsuger - Ferdig', 'n_stovsuger');
    dev('n_ha', 'Home Assistant oppstart'); N('switch.home_assistant_oppstart_varsling', 'on', 'Home Assistant oppstart - Varsling', 'n_ha');
    // Fiks 27.7: flere varsel-kategorier (Kamera, Klima) + en varsel-regel som hjelper (input_boolean.varsel_*, ingen enhet)
    dev('n_bevegelse', 'Kamera - bevegelse ved inngang'); N('switch.kamera_bevegelse_inngang_varsling', 'on', 'Bevegelse ved inngang - Varsling', 'n_bevegelse');
    dev('n_pakke', 'Kamera - pakke levert'); N('switch.kamera_pakke_levert_varsling', 'off', 'Pakke levert - Varsling', 'n_pakke');
    dev('n_fukt', 'Høy fukt bad'); N('switch.hoy_fukt_bad_varsling', 'on', 'Høy fukt bad - Varsling', 'n_fukt');
    add('input_boolean.varsel_dor_last', 'on', { friendly_name: 'Varsel dør låst/åpnet' });
    // KI Utelys (én enhet, tre brytere – hovedbryteren er _auto) og KI Energi (varslingsbryterne, én enhet)
    dev('dev_utelys', 'KI Utelys', 'Utelys');
    ['switch.ki_utelys_auto', 'switch.ki_utelys_kveld', 'switch.ki_utelys_morgen'].forEach((id) => { if (E[id]) { E[id].platform = 'ki_utelys'; E[id].device_id = 'dev_utelys'; } });
  });
})();
