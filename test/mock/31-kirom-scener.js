// Testdata: KI Rom-lysscener for stue (integrasjon ki_lys). sensor.stue_lys_oversikt + button.stue_lys_<id>.
window.mockExtend(({ add }) => {
  const SC = [['maks', 'Maks lys', 'mdi:lightbulb-on', 1], ['komfort', 'Komfort', 'mdi:sofa', 2], ['middag', 'Middag', 'mdi:silverware-fork-knife', 3], ['tv', 'TV-kveld', 'mdi:television-classic', 4], ['mindre', 'Mindre lys', 'mdi:lightbulb-on-40', 5], ['natt', 'Nattmodus', 'mdi:weather-night', 6], ['av', 'Alt av', 'mdi:lightbulb-off', 7]];
  const lys = ['light.stue_tak', 'light.stue_lampe', 'light.stue_led'];
  SC.forEach(([id, navn, ikon]) => add(`button.stue_lys_${id}`, 'unknown', { integrasjon: 'ki_lys', ki_type: 'scene', scene: id, rom: 'Stue', area_id: 'stue', lys, icon: ikon, friendly_name: `Stue ${navn}` }, { platform: 'ki_rom' }));
  add('sensor.stue_lys_oversikt', 2, {
    integrasjon: 'ki_lys', ki_type: 'oversikt', rom: 'Stue', area_id: 'stue', area_ids: ['stue'], er_sone: false, slug: 'stue', lys, roller: {},
    scener: SC.map(([id, navn, ikon, rekkefolge]) => ({ id, navn, ikon, rekkefolge, entity: `button.stue_lys_${id}` })),
    antall_lys: 3, paa_naa: ['light.stue_tak', 'light.stue_led'], icon: 'mdi:lightbulb-group', friendly_name: 'Stue lysscener',
  }, { platform: 'ki_rom' });
  // Fallback-rom uten oversiktssensor: kun knapper (sortert maks … av)
  ['natt', 'maks', 'av'].forEach((id) => add(`button.kjokken_lys_${id}`, 'unknown', { integrasjon: 'ki_lys', ki_type: 'scene', scene: id, area_id: 'kjokken', friendly_name: `Kjøkken ${SC.find((x) => x[0] === id)[1]}`, icon: SC.find((x) => x[0] === id)[2] }, { platform: 'ki_rom' }));
});
