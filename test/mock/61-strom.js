// Testdata for Strøm-popupen (#strom, Del 45): «Inkludert i prisen»-bryterne (input_boolean.include_*) og en
// utility_meter-dagsmåler med `endring`-attributt. Bare test – kortet har aldri mock-data.
window.mockExtend(({ add }) => {
  [['include_nettleie', 'Inkluder nettleie', 'on'], ['include_stromselskap', 'Inkluder strømselskap', 'on'], ['include_stromstotte', 'Inkluder strømstøtte', 'off'], ['include_moms', 'Inkluder moms', 'on']]
    .forEach(([id, n, s]) => add('input_boolean.' + id, s, { friendly_name: n }));
});
// Fiks 47 T: toppkortets kilder (mønstre fra brukerens oppsett – kortet finner dem via søk, aldri faste ID-er)
window.mockExtend(({ add }) => {
  add('sensor.manedlig_forbruk_dagens_kostnad', 48.6, { unit_of_measurement: 'NOK', device_class: 'monetary', friendly_name: 'Dagens kostnad' });
  add('sensor.nettleie_elvia_kapasitetstrinn_intervall', '2-5 kW', { friendly_name: 'Kapasitetstrinn intervall' });
  add('sensor.nettleie_elvia_margin_til_neste_trinn', 1.9, { unit_of_measurement: 'kW', friendly_name: 'Margin til neste trinn' });
  add('sensor.garasje_charger_power', 7200, { unit_of_measurement: 'W', device_class: 'power', friendly_name: 'Garasje lader effekt' });
});
