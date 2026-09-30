// Vanning (Fiks 25.2): døgnstatistikk for KI Vann (Forbruk → Kalender) og hagens vannmåler. Egen fil etter 52-energi.js,
// som svarer på all recorder/statistics_during_period uten å sende videre.
(function () {
  const prev = window.mockHass;
  window.mockHass = function () {
    const h = prev(), oldWS = h.callWS;
    h.callWS = (m) => {
      if (m.type === 'recorder/statistics_during_period' && (m.statistic_ids || []).includes('sensor.hjemme_vann_i_dag')) {
        const s = new Date(m.start_time).getTime(), out = {};
        m.statistic_ids.forEach((id, j) => { out[id] = Array.from({ length: 31 }, (_, i) => { const t = s + i * 86400000; return t < Date.now() - 86400000 ? { start: t, end: t + 86400000, max: id === 'sensor.hjemme_vann_i_dag' ? 220 + ((i * 53) % 260) : ((i + j) * 7) % 60, change: null } : null; }).filter(Boolean); });
        return Promise.resolve(out);
      }
      if (m.type === 'recorder/statistics_during_period' && (m.statistic_ids || []).includes('sensor.hage_vannmaler')) {
        const at = (dd) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + dd); return d; };
        const rows = Array.from({ length: 20 }, (_, i) => { const d = at(-19 + i); return { start: d.getTime(), end: d.getTime() + 86400000, change: [0, 0, 420, 0, 0, 962, 0, 0, 310, 0, 0, 0, 640, 0, 0, 0, 380, 0, 0, 120][i] }; });
        return Promise.resolve({ 'sensor.hage_vannmaler': rows });
      }
      return oldWS(m);
    };
    return h;
  };
})();
