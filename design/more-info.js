(function () {
  if (window.__moreInfo) return; window.__moreInfo = true;
  const slug = n => String(n || '').toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const entOf = el => el.dataset.ent || ((el.dataset.entDomain || 'sensor') + '.' + slug(el.dataset.entName || el.textContent.trim().slice(0, 30)));
  const ICON = { light: 'lightbulb', switch: 'toggle_on', climate: 'thermostat', person: 'person', lock: 'lock', cover: 'garage', media_player: 'cast', camera: 'videocam', vacuum: 'robot_2', alarm_control_panel: 'shield', sensor: 'sensors', todo: 'checklist', weather: 'partly_cloudy_day' };
  const SEL = '[data-ent],[data-ent-domain]';
  let t = null, sx = 0, sy = 0, fired = false, target = null;
  const css = (el, o) => { Object.assign(el.style, o); return el; };
  const mk = (tag, o, txt) => { const e = css(document.createElement(tag), o || {}); if (txt != null) e.textContent = txt; return e; };
  function close() { const o = document.getElementById('__mi'); if (o) o.remove(); }
  function open(el) {
    close(); const ent = entOf(el), dom = ent.split('.')[0], name = el.dataset.entName || ent, state = el.dataset.entState || '';
    window.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: ent } }));
    const root = mk('div', { position: 'fixed', inset: '0', zIndex: '9999', fontFamily: "'Space Grotesk',system-ui,sans-serif", color: '#fafafa' }); root.id = '__mi';
    const bg = mk('div', { position: 'absolute', inset: '0', background: 'rgba(0,0,0,0.55)', animation: 'fadein .2s' }); bg.onclick = close;
    const sh = mk('div', { position: 'absolute', left: '0', right: '0', bottom: '0', maxWidth: '420px', margin: '0 auto', boxSizing: 'border-box', padding: '12px 18px calc(28px + env(safe-area-inset-bottom))', borderRadius: '32px 32px 0 0', background: '#2f2f2f', boxShadow: '0 -20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '14px', transform: 'translateY(30px)', opacity: '0', transition: 'transform .3s cubic-bezier(.34,1.3,.64,1), opacity .2s' });
    sh.appendChild(mk('div', { width: '40px', height: '5px', borderRadius: '3px', background: '#545454', alignSelf: 'center' }));
    const hd = mk('div', { display: 'flex', alignItems: 'center', gap: '12px' });
    const ic = mk('span', { width: '48px', height: '48px', borderRadius: '24px', flex: 'none', display: 'grid', placeItems: 'center', background: '#3a3a3a' }); const g = mk('span', { fontFamily: "'Material Symbols Rounded'", fontSize: '24px', fontVariationSettings: "'FILL' 1" }, ICON[dom] || 'info'); ic.appendChild(g);
    const tx = mk('div', { flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '2px' }); tx.appendChild(mk('span', { fontSize: '18px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, name)); tx.appendChild(mk('span', { fontSize: '12px', color: '#979797', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }, ent));
    const x = mk('button', { width: '40px', height: '40px', borderRadius: '20px', border: '0', background: '#3a3a3a', color: '#fafafa', cursor: 'pointer', display: 'grid', placeItems: 'center' }); x.appendChild(mk('span', { fontFamily: "'Material Symbols Rounded'", fontSize: '20px' }, 'close')); x.onclick = close;
    hd.append(ic, tx, x); sh.appendChild(hd);
    if (state) sh.appendChild(mk('div', { fontSize: '40px', fontWeight: '300', letterSpacing: '-0.03em', lineHeight: '1' }, state));
    const bars = mk('div', { display: 'flex', alignItems: 'flex-end', gap: '3px', height: '48px', padding: '10px 12px', borderRadius: '18px', background: '#232323' });
    for (let i = 0; i < 24; i++) bars.appendChild(mk('span', { flex: '1', borderRadius: '2px', height: (20 + ((i * 37 + ent.length * 13) % 80)) + '%', background: i === 23 ? 'rgb(242 133 201)' : '#454545' }));
    sh.appendChild(mk('span', { fontSize: '12px', color: '#7f7f7f', margin: '0 0 -8px 4px' }, 'Historikk · siste 24 timer')); sh.appendChild(bars);
    const rows = mk('div', { display: 'flex', flexDirection: 'column', padding: '4px 14px', borderRadius: '18px', background: '#232323' });
    [['Domene', dom], ['Sist endret', 'for ' + (2 + ent.length % 40) + ' min siden'], ['Entitets-ID', ent]].forEach(([k, v], i) => { const r = mk('div', { display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '11px 0', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none', fontSize: '13px' }); r.append(mk('span', { color: '#979797' }, k), mk('span', { fontWeight: '500', textAlign: 'right', wordBreak: 'break-all' }, v)); rows.appendChild(r); });
    sh.appendChild(rows);
    const act = mk('div', { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' });
    const b = (label, icon, fn, pink) => { const e = mk('button', { height: '52px', borderRadius: '26px', border: '0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', font: "500 14px 'Space Grotesk',system-ui", background: pink ? 'linear-gradient(145deg, rgb(242 133 201) -10%, rgb(245 205 198) 100%)' : '#3a3a3a', color: pink ? '#2a1720' : '#fafafa' }); e.append(mk('span', { fontFamily: "'Material Symbols Rounded'", fontSize: '20px' }, icon), document.createTextNode(label)); e.onclick = fn; return e; };
    act.append(b('Veksle', 'power_settings_new', () => { close(); el.click(); }, true), b('Innstillinger', 'settings', () => { window.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: ent, view: 'settings' } })); close(); }));
    sh.appendChild(act);
    root.append(bg, sh); document.body.appendChild(root);
    requestAnimationFrame(() => css(sh, { transform: 'translateY(0)', opacity: '1' }));
  }
  const cancel = () => { clearTimeout(t); t = null; };
  document.addEventListener('pointerdown', e => { if (e.button) return; const el = e.target.closest && e.target.closest(SEL); if (!el || e.target.closest('#__mi')) return; fired = false; target = el; sx = e.clientX; sy = e.clientY; cancel(); t = setTimeout(() => { fired = true; navigator.vibrate && navigator.vibrate(18); open(target); }, 520); }, true);
  document.addEventListener('pointermove', e => { if (t && (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8)) cancel(); }, true);
  const swallow = e => { if (fired) { e.stopPropagation(); e.preventDefault(); if (e.type === 'click') fired = false; } };
  document.addEventListener('pointerup', e => { cancel(); swallow(e); }, true);
  document.addEventListener('pointercancel', cancel, true);
  document.addEventListener('click', swallow, true);
  document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest(SEL)) e.preventDefault(); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();
