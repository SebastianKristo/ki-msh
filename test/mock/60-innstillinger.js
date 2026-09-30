// Testdata for Innstillinger (#innstillinger, msh-innstillinger-card, fiks 25.5): natt-/privatmodus, vekking,
// varsel-brytere, push-automasjoner og brytere med etiketten «strom»/«energi». Bare test.
(function () {
  window.mockExtend(({ add, E }) => {
    add('input_boolean.nattmodus', 'off', { friendly_name: 'Nattmodus', icon: 'mdi:power-sleep' });
    add('input_boolean.privatmodus', 'on', { friendly_name: 'Privatmodus', icon: 'mdi:cctv-off' });
    add('input_datetime.vekking', '07:00:00', { friendly_name: 'Vekking', has_date: false, has_time: true });
    add('input_boolean.varsel_vaskemaskin', 'on', { friendly_name: 'Varsel vaskemaskin ferdig' });
    add('automation.push_automation_dor_apen', 'off', { friendly_name: 'Push: døra står åpen', description: 'Varsler når ytterdøra har stått åpen i 5 min' }, { platform: 'automation' });
    add('automation.automation_morgenlys', 'on', { friendly_name: 'Morgenlys', description: 'Skrur på lyset i gangen kl. 06:30' }, { platform: 'automation', area: 'gang' });
    add('input_boolean.ki_prisstyring', 'on', { friendly_name: 'Prisstyring varmtvann' });
    add('automation.lade_bil_billigst', 'off', { friendly_name: 'Lad bilen når strømmen er billigst', description: 'Starter lading i de billigste timene' }, { platform: 'automation' });
    E['input_boolean.ki_prisstyring'].labels = ['strom'];
    E['automation.lade_bil_billigst'].labels = ['energi'];
  });
})();
