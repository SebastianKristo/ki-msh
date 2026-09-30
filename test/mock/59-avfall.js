// Testdata for Søppel (#soppel, msh-avfall-card, fiks 25.4): fire fraksjoner som i brukerens renovasjonsintegrasjon
// (days_to_pickup + raw_date). Tilstanden er en tekst (ikke tall/dato), så Hjem-kortenes egen søppel-autokonfig
// (sensor.neste_tomming) ikke påvirkes. Bare test – kortet har aldri mock-data.
(function () {
  const iso = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00`; };
  window.mockExtend(({ add }) => {
    add('sensor.restavfall', 'Neste henting', { friendly_name: 'Restavfall', days_to_pickup: 1, raw_date: iso(1) }, { platform: 'min_renovasjon' });
    add('sensor.papir_og_papp', 'Neste henting', { friendly_name: 'Papir og papp', days_to_pickup: 8, raw_date: iso(8) }, { platform: 'min_renovasjon' });
    add('sensor.plastemballasje', 'Neste henting', { friendly_name: 'Plastemballasje', days_to_pickup: 1, raw_date: iso(1) }, { platform: 'min_renovasjon' });
    add('sensor.glass_og_metallemballasje', 'Neste henting', { friendly_name: 'Glass- og metallemballasje', days_to_pickup: 22, raw_date: iso(22) }, { platform: 'min_renovasjon' });
  });
})();
