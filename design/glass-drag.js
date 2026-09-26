(function () {
  if (window.__glassDrag) return; window.__glassDrag = true;
  let st = null, suppress = false;
  const isGlass = () => { try { return localStorage.getItem('hjem-nav') === 'glass'; } catch (e) { return false; } };
  const itemsOf = c => [...c.querySelectorAll('button')].filter(b => b.offsetParent && c.contains(b) && !b.closest('[data-gd-skip]'));
  const axisOf = c => { const a = c.dataset.glassDrag; if (a === 'x' || a === 'y') return a; const cs = getComputedStyle(c); return cs.flexDirection === 'column' ? 'y' : 'x'; };
  const pick = (items, x, y) => { let best = null, bd = 1e9; items.forEach(b => { const r = b.getBoundingClientRect(), cx = Math.max(r.left, Math.min(r.right, x)), cy = Math.max(r.top, Math.min(r.bottom, y)), d = Math.hypot(x - cx, y - cy); if (d < bd) { bd = d; best = b; } }); return best; };
  function lensEl() { const l = document.createElement('span'); Object.assign(l.style, { position: 'fixed', zIndex: '9998', pointerEvents: 'none', borderRadius: '999px', background: 'linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0.1))', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -1px 1px rgba(255,255,255,0.18), inset 0 0 0 0.5px rgba(255,255,255,0.4), 0 10px 24px rgba(0,0,0,0.35)', backdropFilter: 'blur(4px) saturate(220%) brightness(1.15)', WebkitBackdropFilter: 'blur(4px) saturate(220%) brightness(1.15)', opacity: '0', transform: 'scale(.8)', transition: 'left .16s cubic-bezier(.34,1.5,.64,1), top .16s cubic-bezier(.34,1.5,.64,1), width .2s, height .2s, opacity .15s, transform .3s cubic-bezier(.34,1.8,.64,1)' }); document.body.appendChild(l); requestAnimationFrame(() => { l.style.opacity = '1'; l.style.transform = 'scale(1.1)'; }); return l; }
  function place(x, y) { const { c, items, lens, ax } = st, hit = pick(items, x, y); if (!hit) return; st.hit = hit; const r = hit.getBoundingClientRect(), cr = c.getBoundingClientRect(), w = r.width, hgt = r.height;
    let L = ax === 'x' ? x - w / 2 : r.left, T = ax === 'y' ? y - hgt / 2 : r.top;
    L = Math.max(cr.left + 2, Math.min(cr.right - w - 2, L)); T = Math.max(cr.top + 2, Math.min(cr.bottom - hgt - 2, T));
    Object.assign(lens.style, { left: L + 'px', top: T + 'px', width: w + 'px', height: hgt + 'px', borderRadius: Math.min(w, hgt) / 2 + 'px' }); }
  document.addEventListener('pointerdown', e => { if (e.button) return; const c = e.target.closest && e.target.closest('[data-glass-drag]'); if (!c || e.target.closest('input,select,textarea,[data-ent],[data-gd-skip]')) return; if (c.dataset.gdGlassOnly && !isGlass()) return;
    st = { c, sx: e.clientX, sy: e.clientY, ax: axisOf(c), on: false, id: e.pointerId }; }, true);
  document.addEventListener('pointermove', e => { if (!st || e.pointerId !== st.id) return; if (window.__tabReorder) { if (st.lens) st.lens.remove(); if (st.on) st.c.style.touchAction = st.prevTA || ''; st = null; return; } const dx = e.clientX - st.sx, dy = e.clientY - st.sy;
    if (!st.on) { const along = st.ax === 'x' ? Math.abs(dx) : Math.abs(dy), across = st.ax === 'x' ? Math.abs(dy) : Math.abs(dx); if (across > 12 && across > along) { st = null; return; } if (along < 8) return;
      st.on = true; st.items = itemsOf(st.c); st.lens = lensEl(); try { st.c.setPointerCapture(e.pointerId); } catch (x) {} st.prevTA = st.c.style.touchAction; st.c.style.touchAction = 'none'; }
    e.preventDefault(); place(e.clientX, e.clientY); }, { capture: true, passive: false });
  const end = e => { if (!st) return; if (window.__tabReorder) { if (st.lens) st.lens.remove(); st = null; return; } const s0 = st; st = null; if (!s0.on) return; e.stopPropagation(); s0.c.style.touchAction = s0.prevTA || ''; const l = s0.lens; l.style.opacity = '0'; l.style.transform = 'scale(.9)'; setTimeout(() => l.remove(), 220);
    suppress = true; setTimeout(() => { suppress = false; }, 350); if (s0.hit && e.type === 'pointerup') { navigator.vibrate && navigator.vibrate(10); s0.hit.click(); } };
  document.addEventListener('pointerup', end, true); document.addEventListener('pointercancel', end, true);
  document.addEventListener('click', e => { if (suppress && e.isTrusted) { e.stopPropagation(); e.preventDefault(); suppress = false; } }, true);
})();
