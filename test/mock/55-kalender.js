// Testdata for Kalender (#kalender, msh-kalender-card, fiks 23.8): kalendere (Google/OsloMet/helligdager/bursdager/
// hyttebesøk/Radarr) via calendars/<id> (samme svar som calendar.get_events), KI Hyttebesøk-oversikter (Oslo/Strømstad/
// Toten), Sonarr (upcoming_media-sensor), Plex (recently added), Når kommer Posten og Norwegian Parcel Tracker.
// Bare test – kortet har aldri mock-data.
(function () {
  const d0 = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
  const at = (n, h, m) => { const d = d0(n); d.setHours(h, m || 0, 0, 0); return d; };
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const iso = (d) => d.toISOString();
  const stay = (person, a, b) => ({ person, start: key(d0(a)), slutt: key(d0(b)), netter: b - a, tittel: person });
  window.mockExtend(({ add }) => {
    add('calendar.sebastian_kristo_no', 'off', { friendly_name: 'Sebastian', message: 'Tannlege', supported_features: 7 }, { platform: 'google' });
    add('calendar.oslomet_timeplan', 'off', { friendly_name: 'OsloMet timeplan' }, { platform: 'ics_calendar' });
    add('calendar.helligdager_i_norge', 'off', { friendly_name: 'Helligdager i Norge' }, { platform: 'holiday' });
    add('calendar.birthdays', 'off', { friendly_name: 'Bursdager', supported_features: 7 }, { platform: 'local_calendar' });
    add('calendar.hyttebesok', 'off', { friendly_name: 'Hyttebesøk', supported_features: 7 }, { platform: 'local_calendar' });
    add('calendar.radarr', 'off', { friendly_name: 'Radarr' }, { platform: 'radarr' });
    const oversikt = (sted, rolle, personer, opphold, kommende, her) => ({
      integrasjon: 'ki_hyttebesok', ki_type: 'oversikt', sted, rolle, kalender: 'calendar.hyttebesok',
      personer: personer.map(([navn, farge]) => ({ navn, farge, her: her.includes(navn) })),
      her_naa: her.map((navn) => ({ navn, siden: key(d0(-2)) })),
      opphold, kommende,
    });
    add('sensor.ki_hyttebesok_oslo_oversikt', 'Sebastian', oversikt('Oslo', 'hjem', [['Sebastian', 'var(--green)'], ['Cybele', 'var(--blue)']], [stay('Sebastian', -30, -26), stay('Cybele', -60, -55)], [], ['Sebastian']), { platform: 'ki_hyttebesok' });
    add('sensor.ki_hyttebesok_stromstad_oversikt', 'Tomt', oversikt('Strömstad', 'hytte', [['Sebastian', 'var(--green)'], ['Cybele', 'var(--blue)'], ['Helge', 'var(--yellow)']], [stay('Cybele', -22, -19), stay('Helge', -45, -38), stay('Sebastian', -80, -73)], [stay('Sebastian', 9, 12)], []), { platform: 'ki_hyttebesok' });
    add('sensor.ki_hyttebesok_toten_oversikt', 'Tomt', oversikt('Toten', 'hytte', [['Helge', 'var(--yellow)'], ['Cybele', 'var(--blue)']], [stay('Helge', -12, -9), stay('Cybele', -100, -96)], [stay('Helge', 20, 23)], []), { platform: 'ki_hyttebesok' });
    const up = (n, h, title, number, episode, network, img) => ({ airdate: iso(at(n, h)), title, number, episode, studio: network, poster: img ? `https://image.tmdb.org/t/p/w300/${img}.jpg` : '', fanart: '', runtime: 45, genres: 'Drama, Thriller', rating: '8.1' });
    add('sensor.sonarr_sonarr_upcoming_media', 3, { friendly_name: 'Sonarr kommende', data: [{ title_default: '$title', line1_default: '$episode' }, up(0, Math.max(0, new Date().getHours() - 1), 'Slow Horses', 'S05E03', 'Tre sure', 'Apple TV+', ''), up(1, 3, 'The Last of Us', 'S03E01', 'Tilbake', 'HBO', ''), up(3, 21, 'Severance', 'S03E04', 'Innsiden', 'Apple TV+', ''), up(6, 22, 'Andor', 'S03E02', 'Ferrix', 'Disney+', ''), up(11, 20, 'Skam', 'S05E01', 'Mandag', 'NRK', '')] }, { platform: 'upcoming_media' });
    add('sensor.plex_recently_added', 4, { friendly_name: 'Plex nylig lagt til', data: [{ title_default: '$title' }, { title: 'Dune: Part Two', aired: key(d0(-1)), poster: '', runtime: 166, genres: 'Sci-fi', rating: '8.6', summary: 'Paul Atreides forener seg med Chani og fremenerne.' }, { title: 'Oppenheimer', aired: key(d0(-3)), poster: '', runtime: 180 }, { title: 'Slow Horses', number: 'S05E02', episode: 'Ingen hjemme', aired: key(d0(-4)), poster: '' }, { title: 'Wicked', aired: key(d0(-6)), poster: '' }] }, { platform: 'upcoming_media' });
    add('media_player.plex_stue', 'idle', { friendly_name: 'Plex (Stue)' }, { platform: 'plex' });
    const post = [d0(1), d0(3), d0(5), d0(8), d0(10)].filter((d) => d.getDay() % 6 !== 0);
    add('sensor.nar_kommer_posten_posten_sensor_next', key(post[0] || d0(1)), { friendly_name: 'Neste postlevering', delivery_dates: post.map(key) }, { platform: 'nar_kommer_posten' });
    add('sensor.nar_kommer_posten_posten_sensor_next_relative', 'i morgen', { friendly_name: 'Neste postlevering (relativ)' }, { platform: 'nar_kommer_posten' });
    const ev = (h, text, where) => ({ time: iso(new Date(Date.now() - h * 3600000)), description: text, location: where });
    add('sensor.pakke_zalando_status', 'Klar for henting', { friendly_name: 'Zalando status', tracking_number: '70730259304981234', pickup_point: 'Coop Extra Majorstuen', delivery_method: 'Pakkeboks', sender: 'Zalando SE', weight: 1.2, events: [ev(3, 'Klar for henting', 'Oslo'), ev(20, 'Ankommet terminal', 'Oslo'), ev(40, 'Sendt fra avsender', 'Berlin')] }, { platform: 'norwegian_parcel_tracker' });
    add('sensor.pakke_komplett_status', 'Under transport', { friendly_name: 'Komplett status', tracking_number: 'CS111222333NO', sender: 'Komplett', delivery_method: 'Hjemlevering', home_delivery_url: 'https://sporing.posten.no/', events: [ev(5, 'Sendingen er på vei', 'Larvik')] }, { platform: 'norwegian_parcel_tracker' });
    add('sensor.pakke_aliexpress_status', 'Under transport', { friendly_name: 'AliExpress status', tracking_number: 'LP00512345678', sender: 'AliExpress', events: [ev(80, 'Mottatt i Norge', 'Oslo'), ev(200, 'Avsendt', 'Shenzhen')] }, { platform: 'norwegian_parcel_tracker' });
    add('sensor.pakke_ikea_status', 'Levert', { friendly_name: 'IKEA status', tracking_number: '12345678901', sender: 'IKEA', events: [ev(30, 'Levert', 'Oslo')] }, { platform: 'norwegian_parcel_tracker' });
  });
  const E = {
    'calendar.sebastian_kristo_no': () => [
      { summary: 'Tannlege', start: { dateTime: iso(at(0, 14, 30)) }, end: { dateTime: iso(at(0, 15, 15)) }, location: 'Majorstuen tannlegesenter' },
      { summary: 'Middag hos Helge', start: { dateTime: iso(at(2, 18)) }, end: { dateTime: iso(at(2, 21)) }, location: 'Toten' },
      { summary: 'Fotball', start: { dateTime: iso(at(4, 19)) }, end: { dateTime: iso(at(4, 20, 30)) } },
      { summary: 'Hytta', start: { date: key(d0(9)) }, end: { date: key(d0(13)) } },
      { summary: 'Frisør', start: { dateTime: iso(at(-5, 10)) }, end: { dateTime: iso(at(-5, 10, 45)) } },
    ],
    'calendar.oslomet_timeplan': () => [1, 2, 3, 8, 9, 10].map((n) => ({ summary: 'DATA2410 forelesning', start: { dateTime: iso(at(n, 10, 15)) }, end: { dateTime: iso(at(n, 12)) }, location: 'P35 Auditorium' })),
    'calendar.helligdager_i_norge': () => [{ summary: 'Fridag', start: { date: key(d0(17)) }, end: { date: key(d0(18)) } }],
    'calendar.birthdays': () => [
      { summary: 'Helge (1958)', start: { date: key(d0(5)) }, end: { date: key(d0(6)) } },
      { summary: 'Cybele', description: 'født 1996-11-02', start: { date: key(d0(35)) }, end: { date: key(d0(36)) } },
      { summary: 'Mormor bursdag', description: 'f. 1941', start: { date: key(d0(70)) }, end: { date: key(d0(71)) } },
      { summary: 'Rune', start: { date: key(d0(120)) }, end: { date: key(d0(121)) } },
    ],
    'calendar.hyttebesok': () => [{ summary: 'Sebastian', location: 'Strömstad', start: { date: key(d0(9)) }, end: { date: key(d0(13)) } }],
    'calendar.radarr': () => [
      { summary: 'Mission: Impossible – The Final Reckoning (Digital release)', description: 'Ethan Hunt og IMF-teamet i sin farligste oppgave.', start: { date: key(d0(2)) }, end: { date: key(d0(3)) } },
      { summary: 'Superman', description: 'Clark Kent forsøker å forene sin kryptonske arv med sin menneskelige oppvekst.', start: { date: key(d0(8)) }, end: { date: key(d0(9)) } },
    ],
  };
  const prev = window.mockHass;
  window.mockHass = function () {
    const h = prev();
    const oldApi = h.callApi;
    h.services = { ...(h.services || {}), norwegian_parcel_tracker: { add_parcel: {}, remove_parcel: {} }, calendar: { create_event: {}, get_events: {} } };
    h.callApi = (method, path) => {
      const m = /^calendars\/(calendar\.[a-z0-9_]+)\?/.exec(path);
      if (m && E[m[1]]) { (window.__calls || []).push(['api', method, path]); return Promise.resolve(E[m[1]]()); }
      return oldApi ? oldApi(method, path) : Promise.resolve([]);
    };
    const oldWS = h.callWS;
    h.callWS = (msg) => {
      if (msg.type === 'calendar/event/create') { (window.__calls || []).push(['ws', msg.type, msg]); return Promise.resolve({}); }
      return oldWS(msg);
    };
    return h;
  };
})();
