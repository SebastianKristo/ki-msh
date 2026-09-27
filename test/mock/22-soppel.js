// Fiks 17.14 · brukerens søppelsensor: «dager,avfallstype,avfallstype» (0 = tømmedag)
window.mockExtend(({ add }) => {
  add('sensor.neste_tomming', '0,Restavfall,Plastavfall', { friendly_name: 'Neste tømming' });
});
