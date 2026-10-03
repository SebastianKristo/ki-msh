// Testdata for Strøm-popupen (#strom, Del 45): «Inkludert i prisen»-bryterne (input_boolean.include_*) og en
// utility_meter-dagsmåler med `endring`-attributt. Bare test – kortet har aldri mock-data.
window.mockExtend(({ add }) => {
  [['include_nettleie', 'Inkluder nettleie', 'on'], ['include_stromselskap', 'Inkluder strømselskap', 'on'], ['include_stromstotte', 'Inkluder strømstøtte', 'off'], ['include_moms', 'Inkluder moms', 'on']]
    .forEach(([id, n, s]) => add('input_boolean.' + id, s, { friendly_name: n }));
});
