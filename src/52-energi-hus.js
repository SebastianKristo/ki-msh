/* M.energiHus · husscenen øverst i Energi-popupen (#energi, fiks 21.1 første kulepunkt + 21.8).
 * Fire håndtegnede nattscener (Enebolig, Rekkehus, Gård, Ved sjøen) som inline SVG, så det virker uten kopiering.
 * Samme tegninger ligger som filer i examples/www/ki/energi-hus*.svg (kopieres til /local/ki/, vinduene tent).
 * Alle scener bruker viewBox 0 0 380 340 (kortet er 340 px høyt → 1:1 når kortet er minst 380 px bredt).
 * Husbilde (inline SVG eller eget bilde med object-fit: contain) og overlay (etiketter, loddrette ledelinjer, prikker,
 * skrå kabel med blå puls) deler viewBox og preserveAspectRatio (xMidYMid meet), så linjene treffer målpunktene
 * uansett skjermbredde.
 * API:
 *   M.energiHus.STYLES · NAMES · FILES · HOUSES[stil] = { vb, ev, grid, home, solar, battery, cable }
 *   M.energiHus.html({ style, values:{ev,grid,home,solar,battery}, labels:{ev,grid,home,…}, hide:{ev,grid,home}, flow, lightsOn, kw,
 *                      custom_image, targets:{ev:[x,y],…}, cable })  → HTML-streng (inkl. <style>)
 *   M.energiHus.svg(style, lightsOn, idPrefix?, standalone?) · thumb(style) · targetsFor(style, targets) · CSS
 *   Verdier: tall = W (vises som «480 W» / «1,2 kW»), streng vises som den er, null → «–».
 */
(function () {
  const M = window.MSH;
  if (!M || M.energiHus) return;
  const esc = M.esc || ((s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const VB = '0 0 380 340';
  const DARK = '#2a2c34'; // mørke vinduer (lys av)
  const TRIM = '#dcd9d0'; // hvite hjørnebord/lister (dempet for natt)

  // ---------- Felles tegnehjelpere ----------
  const defs = (p) => `<defs>
<linearGradient id="${p}-lit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9ad"/><stop offset="1" stop-color="#f1ad57"/></linearGradient>
<filter id="${p}-blur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.4"/></filter>
<filter id="${p}-soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.4"/></filter>
<radialGradient id="${p}-lamp" cx=".5" cy=".1" r=".9"><stop offset="0" stop-color="#fff4d2" stop-opacity=".85"/><stop offset=".55" stop-color="#ffe2a6" stop-opacity=".25"/><stop offset="1" stop-color="#ffe2a6" stop-opacity="0"/></radialGradient>
<linearGradient id="${p}-spill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd99a" stop-opacity=".30"/><stop offset="1" stop-color="#ffd99a" stop-opacity="0"/></linearGradient>
<linearGradient id="${p}-gnd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#303531"/><stop offset="1" stop-color="#262927"/></linearGradient>
<linearGradient id="${p}-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#223040"/><stop offset="1" stop-color="#161d26"/></linearGradient>
<linearGradient id="${p}-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a4656"/><stop offset="1" stop-color="#1f2731"/></linearGradient>
</defs>`;

  // Vindu med karm, sprosser og sålbenk. Tent: varm gradient + glød; slukket: #2a2c34.
  function win(p, lit, x, y, w, h, o = {}) {
    const fr = o.frame || TRIM, c = (o.bars || [2, 2])[0], r = (o.bars || [2, 2])[1];
    let s = '';
    if (lit) s += `<rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" rx="4" fill="#f7c66c" opacity=".55" filter="url(#${p}-blur)"/>`;
    s += `<rect x="${x - 1.3}" y="${y - 1.3}" width="${w + 2.6}" height="${h + 2.6}" rx=".8" fill="${fr}"/>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${lit ? `url(#${p}-lit)` : DARK}"/>`;
    if (!lit) s += `<path d="M${x + 1.5} ${y + h * 0.55}L${x + w * 0.45} ${y + 1.5}" stroke="#fff" stroke-opacity=".07" stroke-width="2"/>`;
    for (let i = 1; i < c; i++) s += `<path d="M${x + (w * i) / c} ${y}V${y + h}" stroke="${fr}" stroke-width="1"/>`;
    for (let i = 1; i < r; i++) s += `<path d="M${x} ${y + (h * i) / r}H${x + w}" stroke="${fr}" stroke-width="1"/>`;
    if (o.sill !== false) s += `<rect x="${x - 2.6}" y="${y + h + 1}" width="${w + 5.2}" height="1.9" rx=".5" fill="${fr}"/>`;
    return `<g class="ehus-win${lit ? ' lit' : ''}">${s}</g>`;
  }
  // Vindu på en skrå sidevegg (skjæring, ikke skalering): sentrum (cx,cy), k = dy/dx for dybden.
  const sideWin = (p, lit, cx, cy, w, h, k, o) => `<g transform="translate(${cx} ${cy}) matrix(1 ${k} 0 1 0 0)">${win(p, lit, -w / 2, -h / 2, w, h, o)}</g>`;
  // Horisontale/vertikale panellinjer innenfor et rektangel
  const hLines = (x0, x1, y0, y1, step, op = 0.1) => { let d = ''; for (let y = y0 + step; y < y1; y += step) d += `M${x0} ${y}H${x1}`; return `<path d="${d}" stroke="#000" stroke-opacity="${op}" stroke-width=".8"/>`; };
  const vLines = (x0, x1, y0, y1, step, op = 0.12) => { let d = ''; for (let x = x0 + step; x < x1; x += step) d += `M${x} ${y0}V${y1}`; return `<path d="${d}" stroke="#000" stroke-opacity="${op}" stroke-width=".7"/>`; };
  const stars = (list) => `<g fill="#e9eef7">${list.map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" opacity="${o}"/>`).join('')}</g>`;
  const ground = (p, y) => `<rect x="-1200" y="${y}" width="2780" height="500" fill="url(#${p}-gnd)"/><path d="M-1200 ${y}H1580" stroke="#3b413c" stroke-width="1.2"/>`;
  const spruce = (x, by, h, col = '#202a25') => {
    const w = h * 0.42;
    return `<g fill="${col}"><rect x="${x - 1.6}" y="${by - 8}" width="3.2" height="8" fill="#2a2522"/>` +
      [0, 1, 2, 3].map((i) => { const t = by - 6 - i * h * 0.22, ww = w * (1 - i * 0.2); return `<path d="M${x - ww / 2} ${t}L${x} ${t - h * 0.36}L${x + ww / 2} ${t}Z"/>`; }).join('') + '</g>';
  };
  // Målpunkt-markører (usynlige) – brukes av testen for å sjekke at overlayet treffer tegningen
  const tmark = (h) => ['ev', 'grid', 'home'].map((k) => `<circle class="ehus-t" data-t="${k}" cx="${h[k][0]}" cy="${h[k][1]}" r="0" fill="none"/>`).join('');

  // Bil sett forfra (fronten ut mot porten), lokal bredde 50, bunn = 0. Uniform skalering.
  function carFront(p, cx, by, w, col, hi) {
    const s = w / 50;
    return `<g transform="translate(${cx} ${by}) scale(${s})">
<ellipse cx="0" cy="-1" rx="29" ry="3.4" fill="#000" opacity=".4"/>
<ellipse cx="0" cy="7" rx="30" ry="6" fill="#fff1c9" opacity=".16" filter="url(#${p}-soft)"/>
<rect x="-24" y="-12" width="8" height="12" rx="2" fill="#141518"/><rect x="16" y="-12" width="8" height="12" rx="2" fill="#141518"/>
<rect x="-13" y="-46.5" width="26" height="3" rx="1.2" fill="${col}"/>
<path d="M-18 -30L-13 -44H13L18 -30Z" fill="url(#${p}-glass)"/>
<path d="M-10 -32L-5 -42.5H-1.5L-6.5 -32Z" fill="#fff" opacity=".1"/>
<path d="M-18 -30L-13 -44M18 -30L13 -44" stroke="${col}" stroke-width="1.8"/>
<ellipse cx="-26.5" cy="-29" rx="3" ry="1.7" fill="${col}"/><ellipse cx="26.5" cy="-29" rx="3" ry="1.7" fill="${col}"/>
<path d="M-25 -6V-22Q-24 -28 -18 -30H18Q24 -28 25 -22V-6Q25 -4 23 -4H-23Q-25 -4 -25 -6Z" fill="${col}"/>
<path d="M-22 -24H22L18 -30H-18Z" fill="${hi}"/>
<ellipse cx="-17.5" cy="-19" rx="9" ry="5" fill="#fff1c9" opacity=".5" filter="url(#${p}-soft)"/><ellipse cx="17.5" cy="-19" rx="9" ry="5" fill="#fff1c9" opacity=".5" filter="url(#${p}-soft)"/>
<ellipse cx="-17.5" cy="-19" rx="5" ry="2.3" fill="#fffaf0"/><ellipse cx="17.5" cy="-19" rx="5" ry="2.3" fill="#fffaf0"/>
<rect x="-7.5" y="-16" width="15" height="3.6" rx="1.6" fill="#1a2028"/>
<rect x="-5" y="-10.5" width="10" height="3.2" rx=".6" fill="#cfcfcf"/>
<path d="M-24 -6.5H24" stroke="#000" stroke-opacity=".25" stroke-width="1"/>
</g>`;
  }
  // Bil fra siden, fronten mot venstre, lokal lengde 110, bunn = 0.
  function carSide(p, x, by, col, hi) {
    return `<g transform="translate(${x} ${by})">
<ellipse cx="55" cy="-1" rx="56" ry="3.5" fill="#000" opacity=".4"/>
<path d="M4 -8Q2 -18 10 -20L31 -23L45 -35Q49 -37 57 -37H81Q87 -37 91 -33L101 -23Q108 -22 108 -14V-8Q108 -6 106 -6H6Q4 -6 4 -8Z" fill="${col}"/>
<path d="M10 -20L31 -23H100" stroke="${hi}" stroke-width="1.4" fill="none"/>
<path d="M47 -33L57 -34.5H66V-23.5H36Z" fill="url(#${p}-glass)"/><path d="M69 -34.5H80Q84 -34.5 87 -31L95 -23.5H69Z" fill="url(#${p}-glass)"/>
<path d="M50 -25L57 -33H60L53 -25Z" fill="#fff" opacity=".1"/>
<path d="M67.5 -35V-8" stroke="#000" stroke-opacity=".25" stroke-width=".8"/>
<circle cx="23" cy="-6" r="7.2" fill="#141518"/><circle cx="23" cy="-6" r="3" fill="#80858d"/>
<circle cx="88" cy="-6" r="7.2" fill="#141518"/><circle cx="88" cy="-6" r="3" fill="#80858d"/>
<ellipse cx="4" cy="-15" rx="8" ry="4" fill="#fff1c9" opacity=".45" filter="url(#${p}-soft)"/>
<ellipse cx="6.5" cy="-15" rx="3" ry="2" fill="#fffaf0"/>
<rect x="104.5" y="-18" width="3" height="4" rx="1" fill="#e2574c"/>
<rect x="14" y="-16" width="3.4" height="2.4" rx=".6" fill="#1c1f24"/>
</g>`;
  }
  // Veggmontert lader (front), sentrum (cx,cy)
  const wallCharger = (cx, cy) => `<g><rect x="${cx - 5.5}" y="${cy - 9}" width="11" height="18" rx="2.2" fill="#eceef1"/><rect x="${cx - 5.5}" y="${cy - 9}" width="11" height="18" rx="2.2" fill="none" stroke="#a9aeb6" stroke-width=".6"/>
<rect x="${cx - 3.2}" y="${cy - 6}" width="6.4" height="4.2" rx=".8" fill="#1f2a33"/><circle cx="${cx}" cy="${cy + 2.5}" r="1.1" fill="#73b9f2"/><circle cx="${cx}" cy="${cy + 2.5}" r="3" fill="#73b9f2" opacity=".25"/></g>`;
  // Lader på høyre innervegg (sett skrått)
  const innerCharger = (cx, cy) => `<g><path d="M${cx - 3.5} ${cy - 8}L${cx + 3.5} ${cy - 5}V${cy + 9}L${cx - 3.5} ${cy + 6}Z" fill="#eef0f2" stroke="#a9aeb6" stroke-width=".5"/>
<path d="M${cx - 2} ${cy - 4.5}L${cx + 2} ${cy - 2.8}V${cy}L${cx - 2} ${cy - 1.7}Z" fill="#1f2a33"/><circle cx="${cx}" cy="${cy + 3}" r=".9" fill="#73b9f2"/></g>`;

  // Garasjerom i perspektiv, klippet til portåpningen. o: åpning (x0,y0,x1,y1) og bakvegg (bx0,by0,bx1,by1).
  function garageRoom(p, id, o, inner) {
    const { x0, y0, x1, y1, bx0, by0, bx1, by1 } = o, lx = (bx0 + bx1) / 2;
    return `<clipPath id="${p}-${id}"><rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/></clipPath>
<g clip-path="url(#${p}-${id})">
<path d="M${x0} ${y0}H${x1}L${bx1} ${by0}H${bx0}Z" fill="#8f7150"/>
<path d="M${x0} ${y0}L${bx0} ${by0}V${by1}L${x0} ${y1}Z" fill="#a4835a"/>
<path d="M${x1} ${y0}L${bx1} ${by0}V${by1}L${x1} ${y1}Z" fill="#f0d5a3"/>
<rect x="${bx0}" y="${by0}" width="${bx1 - bx0}" height="${by1 - by0}" fill="#dcb883"/>
${hLines(bx0, bx1, by0, by1, 5, 0.05)}
<path d="M${x0} ${y1}H${x1}L${bx1} ${by1}H${bx0}Z" fill="#6f6459"/>
<path d="M${bx0} ${by1}H${bx1}" stroke="#5b5048" stroke-width="1"/>
<path d="M${bx0} ${by0 + 1}H${bx1}M${x1} ${y0 + 1}L${bx1} ${by0 + 1}M${x0} ${y0 + 1}L${bx0} ${by0 + 1}" stroke="#fbeed3" stroke-width="1.6"/>
<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="url(#${p}-lamp)"/>
<rect x="${lx - 5}" y="${(y0 + by0) / 2 - 1}" width="10" height="2" rx="1" fill="#fffbef"/>
<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="3.5" fill="#34373e"/>
${inner}
</g>
<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="#777d88" stroke-width="1.4"/>
<path d="M${x0} ${y1}L${x0 - 16} ${y1 + 36}H${x1 + 16}L${x1} ${y1}Z" fill="url(#${p}-spill)"/>`;
  }

  // ---------- Hus-definisjoner: målpunkter og kabel (samme koordinater som tegningene) ----------
  const HOUSES = {
    enebolig: { vb: VB, ev: [104, 261], grid: [223, 254], home: [288, 150], solar: [206, 150], battery: [212, 282], cable: 'M223 262V297L128 313L111 300L104 270' },
    rekkehus: { vb: VB, ev: [140, 290], grid: [234, 252], home: [261, 195], solar: [150, 142], battery: [226, 282], cable: 'M234 259V301L147 322H140V304' },
    gard: { vb: VB, ev: [107, 262], grid: [196, 262], home: [246, 195], solar: [258, 140], battery: [188, 286], cable: 'M196 269V301L119 314L113 300L107 271' },
    sjo: { vb: VB, ev: [99, 279.4], grid: [192, 276], home: [232, 135], solar: [278, 120], battery: [180, 288], cable: 'M192 282V299L108 305L99 289' },
  };
  const NAMES = { enebolig: 'Enebolig', rekkehus: 'Rekkehus', gard: 'Gård', sjo: 'Ved sjøen' };
  const FILES = { enebolig: 'energi-hus.svg', rekkehus: 'energi-hus-rekkehus.svg', gard: 'energi-hus-gard.svg', sjo: 'energi-hus-sjo.svg' };
  const STYLES = ['enebolig', 'rekkehus', 'gard', 'sjo'];

  // ---------- Enebolig: hus med saltak (gavl mot høyre), frittliggende garasje med åpen port ----------
  function enebolig(p, L) {
    const k = -15 / 40, W = '#5e6471', S = '#4b505c';
    return `${defs(p)}
${stars([[20, 70, .9, .5], [64, 96, .7, .35], [150, 78, .8, .4], [330, 84, .9, .5], [362, 120, .7, .3], [250, 70, .6, .3], [110, 140, .6, .25]])}
${ground(p, 298)}
<path d="M28 300H112L126 340H14Z" fill="#34363a"/>
${spruce(350, 300, 118)}${spruce(372, 300, 84, '#1c2521')}
<path d="M122 206L144 198V292L122 300Z" fill="#3c4049"/>
<rect x="18" y="206" width="104" height="94" fill="#4b505a"/>${hLines(18, 122, 206, 300, 7, 0.09)}
<path d="M14 198H126L148 190H36Z" fill="#3d414a"/><rect x="14" y="198" width="112" height="9" fill="#2a2d34"/><path d="M126 198L148 190V199L126 207Z" fill="#23262c"/>
<path d="M14 198.5H126L148 190.5" stroke="#8b919b" stroke-width="1.2" fill="none"/>
${garageRoom(p, 'gar', { x0: 30, y0: 222, x1: 110, y1: 300, bx0: 50, by0: 236, bx1: 92, by1: 280 },
  innerCharger(104, 261) + `<path d="M104 270C105 281 99 285 94 281" stroke="#17181b" stroke-width="1.3" fill="none"/>` + carFront(p, 70, 298, 50, '#5b7ca0', '#6d8fb4'))}
<rect x="186" y="92" width="14" height="40" fill="#3b3434"/><rect x="184" y="90" width="18" height="4" fill="#26262a"/>
<path d="M130 182H268V300H130Z" fill="${W}"/>${hLines(130, 268, 182, 300, 6, 0.1)}
<path d="M268 182L308 167V285L268 300Z" fill="${S}"/>
<path d="M268 182L288 118.5L308 167Z" fill="${S}"/>
<clipPath id="${p}-roof"><path d="M120 187H272L290 114H142Z"/></clipPath>
<path d="M120 187H272L290 114H142Z" fill="#2c2f36"/>
<g clip-path="url(#${p}-roof)">${(() => { let d = ''; for (let y = 120; y < 187; y += 7) d += `M100 ${y}H300`; return `<path d="${d}" stroke="#3b3f47" stroke-width="1.1"/>`; })()}</g>
<path d="M142 114H290" stroke="#1f2227" stroke-width="2.4"/>
<path d="M120 187H272" stroke="${TRIM}" stroke-width="1.8"/>
<path d="M265 185L288 115.5L311 166" stroke="${TRIM}" stroke-width="2.4" fill="none" stroke-linejoin="round"/>
<rect x="130" y="186" width="4" height="114" fill="${TRIM}"/><rect x="264" y="186" width="4" height="114" fill="${TRIM}"/><path d="M307 168V286" stroke="${TRIM}" stroke-width="2"/>
${win(p, L, 144, 206, 30, 30)}${win(p, L, 184, 206, 30, 30)}
${sideWin(p, L, 288, 150, 16, 24, k, { bars: [2, 3] })}${sideWin(p, L, 288, 232, 18, 24, k)}
<rect x="232" y="242" width="24" height="58" fill="${TRIM}"/><rect x="234" y="244" width="20" height="56" fill="#2f3b4b"/>
<rect x="237" y="248" width="14" height="10" fill="${L ? `url(#${p}-lit)` : DARK}"/><circle cx="251" cy="274" r="1.2" fill="#c9ccd2"/>
<circle cx="244" cy="237" r="5" fill="#ffe2a0" opacity=".35" filter="url(#${p}-soft)"/><circle cx="244" cy="237" r="1.6" fill="#fff4d6"/>
<rect x="226" y="298" width="36" height="4" fill="#595c61"/>
<rect x="217.5" y="246" width="11" height="16" rx="1.5" fill="#c9ccd2"/><rect x="219.5" y="249" width="7" height="4" fill="#27313a"/><circle cx="223" cy="257.5" r="1.2" fill="#66d19e"/>
${tmark(HOUSES.enebolig)}`;
  }

  // ---------- Rekkehus: tre enheter, vårt til høyre (lys i vinduene), bil og ladestolpe foran ----------
  function rekkehus(p, L) {
    const k = -12 / 30, units = [[18, '#6a4d47', '#7a5b54'], [106, '#58654f', '#67735e'], [194, '#5d6778', '#6b7688']];
    const unit = ([x, c], i) => {
      const me = i === 2;
      return `<rect x="${x}" y="170" width="88" height="130" fill="${c}"/>${vLines(x, x + 88, 170, 300, 4, 0.1)}
${me ? win(p, L, 242, 182, 38, 26, { bars: [3, 2] }) : win(p, false, x + 12, 184, 24, 24) + win(p, i === 0 && L, x + 52, 184, 24, 24, { frame: '#cfccc4' })}
${me ? win(p, L, 244, 232, 30, 28, { bars: [3, 2] }) : win(p, false, x + 44, 232, 30, 28, { bars: [3, 2] })}
<rect x="${x + 10}" y="244" width="22" height="56" fill="${TRIM}"/><rect x="${x + 12}" y="246" width="18" height="54" fill="${me ? '#2d3a4c' : '#33302e'}"/>
<rect x="${x + 15}" y="250" width="12" height="9" fill="${me && L ? `url(#${p}-lit)` : DARK}"/><path d="M${x + 7} 242H${x + 35}" stroke="${TRIM}" stroke-width="2.4"/>`;
    };
    return `${defs(p)}
${stars([[26, 74, .9, .5], [96, 92, .6, .3], [190, 70, .8, .4], [336, 96, .9, .5], [362, 70, .6, .35], [300, 132, .6, .3]])}
${ground(p, 298)}
<rect x="-1200" y="303" width="2780" height="3" fill="#3a3c3f"/>
${spruce(352, 300, 120)}${spruce(8, 300, 90, '#1c2521')}
<rect x="44" y="96" width="12" height="40" fill="#3b3434"/><rect x="42" y="94" width="16" height="4" fill="#26262a"/>
<rect x="224" y="94" width="12" height="40" fill="#3b3434"/><rect x="222" y="92" width="16" height="4" fill="#26262a"/>
<path d="M282 170L312 158V288L282 300Z" fill="#4c5563"/>
<path d="M282 170L297 112L312 158Z" fill="#4c5563"/>
${sideWin(p, L, 297, 150, 12, 18, k)}
<clipPath id="${p}-roof"><path d="M12 174H286L300 110H27Z"/></clipPath>
<path d="M12 174H286L300 110H27Z" fill="#2c2f36"/>
<g clip-path="url(#${p}-roof)">${(() => { let d = ''; for (let y = 116; y < 174; y += 7) d += `M0 ${y}H320`; return `<path d="${d}" stroke="#3b3f47" stroke-width="1.1"/>`; })()}
<path d="M106 176L120 110M194 176L208 110" stroke="#4a4d54" stroke-width="4"/></g>
<path d="M27 110H300" stroke="#1f2227" stroke-width="2.4"/>
${units.map(unit).join('')}
<path d="M106 170V300M194 170V300" stroke="#8a8e95" stroke-width="2.4"/>
<path d="M12 174H286" stroke="${TRIM}" stroke-width="1.8"/><path d="M279 172L297 109.5L315 157" stroke="${TRIM}" stroke-width="2.2" fill="none" stroke-linejoin="round"/>
<path d="M312 159V288" stroke="${TRIM}" stroke-width="1.6"/><rect x="280" y="172" width="3.5" height="128" fill="${TRIM}"/>
<rect x="229" y="245" width="10" height="14" rx="1.4" fill="#c9ccd2"/><rect x="231" y="248" width="6" height="3.6" fill="#27313a"/><circle cx="234" cy="255.5" r="1.1" fill="#66d19e"/>
<g fill="#26332b"><ellipse cx="60" cy="298" rx="16" ry="6"/><ellipse cx="150" cy="298" rx="14" ry="5.5"/><ellipse cx="282" cy="298" rx="12" ry="5"/></g>
<rect x="135" y="280" width="10" height="44" rx="2.5" fill="#dfe2e7"/><rect x="135" y="280" width="10" height="44" rx="2.5" fill="none" stroke="#a9aeb6" stroke-width=".6"/>
<rect x="136.8" y="285" width="6.4" height="9" rx="1" fill="#1f2a33"/><rect x="138" y="287" width="4" height="2" fill="#73b9f2" opacity=".8"/>
<circle cx="140" cy="298" r="1.2" fill="#73b9f2"/><circle cx="140" cy="298" r="4" fill="#73b9f2" opacity=".2"/>
<path d="M144 300C152 306 156 308 163 309" stroke="#17181b" stroke-width="1.4" fill="none"/>
${carSide(p, 154, 324, '#7d8791', '#96a0aa')}
${tmark(HOUSES.rekkehus)}`;
  }

  // ---------- Gård: rød låve med åpen låveport (bil + lader), hvitt våningshus med hjørnebord ----------
  function gard(p, L) {
    const k = -11 / 30, R = '#8a3a33', RS = '#6e2e29', Wh = '#a9a7a0', WS = '#8c8a84';
    return `${defs(p)}
${stars([[18, 70, .8, .45], [150, 88, .7, .35], [180, 64, .6, .3], [336, 76, .9, .5], [366, 118, .7, .35], [300, 64, .6, .3]])}
${ground(p, 298)}
<path d="M40 300H116L130 340H26Z" fill="#35332f"/>
${spruce(356, 300, 124)}${spruce(176, 300, 70, '#1c2521')}
<path d="M150 182L174 173V291L150 300Z" fill="${RS}"/>${vLines(150, 174, 175, 300, 6, 0.14)}
<clipPath id="${p}-broof"><path d="M82 112L106 103L180 175L156 184Z"/></clipPath>
<path d="M82 112L106 103L180 175L156 184Z" fill="#34302f"/>
<g clip-path="url(#${p}-broof)">${(() => { let d = ''; for (let i = 1; i < 11; i++) { const t = i / 11; d += `M${82 + 74 * t} ${112 + 72 * t}L${106 + 74 * t} ${103 + 72 * t}`; } return `<path d="${d}" stroke="#423d3b" stroke-width="1.1"/>`; })()}</g>
<clipPath id="${p}-barn"><path d="M14 182L82 116L150 182V300H14Z"/></clipPath><path d="M14 182L82 116L150 182V300H14Z" fill="${R}"/><g clip-path="url(#${p}-barn)">${vLines(14, 150, 110, 300, 5, 0.13)}</g>
<path d="M8 185L82 112L156 185" stroke="${TRIM}" stroke-width="2.6" fill="none" stroke-linejoin="round"/>
<rect x="14" y="184" width="3.5" height="116" fill="${TRIM}"/><rect x="146.5" y="184" width="3.5" height="116" fill="${TRIM}"/><path d="M174 174V291" stroke="${TRIM}" stroke-width="1.6"/>
${win(p, L, 72, 148, 20, 16, { bars: [2, 1] })}
${garageRoom(p, 'lave', { x0: 40, y0: 222, x1: 116, y1: 300, bx0: 58, by0: 236, bx1: 98, by1: 280 },
  innerCharger(107, 262) + `<path d="M107 271C108 282 102 286 97 282" stroke="#17181b" stroke-width="1.3" fill="none"/>` + carFront(p, 77, 298, 48, '#b9bcc2', '#cfd2d7'))}
<path d="M40 222L22 216V296L40 300Z" fill="#7a332d"/><path d="M116 222L134 216V296L116 300Z" fill="#7a332d"/>
<path d="M23 219L39 297M39 225L23 294M115 297L133 219M115 225L133 294" stroke="${TRIM}" stroke-width="1.6"/>
<path d="M22 216L40 222V300L22 296ZM116 222L134 216V296L116 300Z" fill="none" stroke="${TRIM}" stroke-width="1.6"/>
<rect x="238" y="72" width="14" height="44" fill="#3b3434"/><rect x="236" y="70" width="18" height="4" fill="#26262a"/>
<path d="M300 168L330 157V289L300 300Z" fill="${WS}"/><path d="M300 168L315 106L330 157Z" fill="${WS}"/>${hLines(300, 330, 106, 300, 6, 0.06)}
${sideWin(p, L, 315, 142, 12, 18, k)}${sideWin(p, L, 315, 200, 14, 22, k, { bars: [2, 3] })}${sideWin(p, L, 315, 250, 14, 22, k, { bars: [2, 3] })}
<clipPath id="${p}-roof"><path d="M184 172H304L318 104H199Z"/></clipPath>
<path d="M184 172H304L318 104H199Z" fill="#2b2d33"/>
<g clip-path="url(#${p}-roof)">${(() => { let d = ''; for (let y = 110; y < 172; y += 7) d += `M170 ${y}H330`; return `<path d="${d}" stroke="#3a3d45" stroke-width="1.1"/>`; })()}</g>
<path d="M199 104H318" stroke="#1f2227" stroke-width="2.4"/>
<rect x="190" y="168" width="110" height="132" fill="${Wh}"/>${hLines(190, 300, 168, 300, 5, 0.07)}
<path d="M184 172H304" stroke="#e6e3da" stroke-width="1.8"/><path d="M297 170L315 103.5L333 156" stroke="#e6e3da" stroke-width="2.4" fill="none" stroke-linejoin="round"/>
<rect x="190" y="170" width="4.5" height="130" fill="#e6e3da"/><rect x="295.5" y="170" width="4.5" height="130" fill="#e6e3da"/><path d="M190 222H300" stroke="#e6e3da" stroke-width="2.4"/>
<path d="M329.5 158V289" stroke="#e6e3da" stroke-width="1.8"/>
${win(p, L, 202, 182, 20, 28, { bars: [2, 3], frame: '#eeebe3' })}${win(p, L, 236, 181, 20, 28, { bars: [2, 3], frame: '#eeebe3' })}${win(p, L, 270, 182, 20, 28, { bars: [2, 3], frame: '#eeebe3' })}
${win(p, L, 202, 232, 20, 28, { bars: [2, 3], frame: '#eeebe3' })}${win(p, L, 270, 232, 20, 28, { bars: [2, 3], frame: '#eeebe3' })}
<path d="M232 244L246 234L260 244Z" fill="#2b2d33"/><path d="M231 244.5L246 233.5L261 244.5" stroke="#eeebe3" stroke-width="1.4" fill="none"/>
<rect x="236" y="246" width="20" height="54" fill="#eeebe3"/><rect x="238" y="248" width="16" height="52" fill="#4f3a30"/><rect x="241" y="252" width="10" height="8" fill="${L ? `url(#${p}-lit)` : DARK}"/>
<rect x="232" y="298" width="28" height="4" fill="#5d5f63"/>
<rect x="190.5" y="254" width="11" height="15" rx="1.4" fill="#c9ccd2"/><rect x="192.5" y="257" width="7" height="3.8" fill="#27313a"/><circle cx="196" cy="265" r="1.1" fill="#66d19e"/>
<g stroke="#5a4a3c" stroke-width="1.6"><path d="M142 322L150 306M154 322L162 306M166 322L174 306M178 322L186 306M300 322L308 306M312 322L320 306M324 322L332 306M336 322L344 306M348 322L356 306M360 322L368 306"/>
<path d="M140 316L190 312M298 316L372 312" stroke-width="1.2"/></g>
${tmark(HOUSES.gard)}`;
  }

  // ---------- Ved sjøen: to-etasjes enebolig i grå-blått stående panel + ny dobbel garasje (21.8), svaberg, brygge, sjø ----------
  function sjo(p, L) {
    const k = -13 / 34, W = '#56657a', S = '#46536a';
    return `${defs(p)}
${stars([[20, 64, .8, .45], [120, 92, .7, .35], [170, 70, .6, .3], [320, 64, .6, .35], [300, 108, .6, .3], [70, 150, .6, .25]])}
<circle cx="354" cy="78" r="20" fill="#f2ecd6" opacity=".12" filter="url(#${p}-blur)"/><circle cx="354" cy="78" r="9" fill="#ede7d2" opacity=".9"/>
<rect x="-1200" y="304" width="2780" height="500" fill="url(#${p}-sea)"/>
<g stroke="#e9e3cf" stroke-linecap="round"><path d="M344 318H364M348 326H360M340 334H368" stroke-opacity=".28" stroke-width="1.4"/></g>
<g stroke="#8fb1d6" stroke-opacity=".12" stroke-width="1"><path d="M-1200 316H1580M-1200 328H1580"/></g>
<path d="M-1200 296H176L184 300L168 308L130 312L96 308L60 312L20 309L-1200 309Z" fill="#2d322e"/>
<path d="M-1200 296H1580V300H-1200Z" fill="#303630"/>
<path d="M150 300C170 294 200 296 228 300C258 304 262 312 246 316C220 320 190 316 160 314C140 312 138 304 150 300Z" fill="#4a4c50"/>
<path d="M150 300C170 294 200 296 228 300" stroke="#65686d" stroke-width="1.2" fill="none"/>
<path d="M-10 306C20 300 60 302 90 306C104 309 100 316 80 316C50 317 10 316 -10 314Z" fill="#43454a"/>
<path d="M240 306H392V312H240Z" fill="#6b5846"/><path d="M240 306H392" stroke="#8a735b" stroke-width="1"/>
${vLines(240, 392, 306, 312, 7, 0.25)}
<g fill="#4d3f33"><rect x="250" y="312" width="3" height="18"/><rect x="300" y="312" width="3" height="16"/><rect x="350" y="312" width="3" height="18"/></g>
${spruce(146, 297, 110, '#1e2823')}${spruce(160, 297, 76, '#1a231f')}
<path d="M130 216L152 208V290L130 298Z" fill="#3e434c"/>
${sideWin(p, L, 141, 244, 10, 14, -8 / 22, { bars: [2, 2] })}
<rect x="6" y="216" width="124" height="82" fill="#4a4f59"/>${vLines(6, 130, 216, 298, 4, 0.1)}
<path d="M2 208H134L156 200H24Z" fill="#3c4049"/><rect x="2" y="208" width="132" height="8" fill="#26292f"/><path d="M134 208L156 200V208L134 216Z" fill="#202328"/>
<path d="M2 208.5H134L156 200.5" stroke="#aab1bc" stroke-width="1.4" fill="none"/>
${garageRoom(p, 'gar', { x0: 16, y0: 232, x1: 90, y1: 298, bx0: 34, by0: 244, bx1: 74, by1: 282 },
  `<path d="M74 262H83L90 258" stroke="#8c6f4b" stroke-width="1.2" fill="none"/>` + carFront(p, 45, 296, 46, '#a2464a', '#b95a5d'))}
<rect x="6" y="216" width="3" height="82" fill="${TRIM}"/><rect x="127" y="216" width="3" height="82" fill="${TRIM}"/>
${wallCharger(99, 279.4)}
<path d="M99 288.4C99 296 90 297 78 291C72 288 70 286 68 284" stroke="#17181b" stroke-width="1.3" fill="none"/>
<circle cx="99" cy="226" r="5" fill="#ffe2a0" opacity=".3" filter="url(#${p}-soft)"/><rect x="96.5" y="224" width="5" height="3" rx="1" fill="#fff1c9"/>
<rect x="272" y="62" width="13" height="46" fill="#4a3b37"/><rect x="270" y="60" width="17" height="4" fill="#26262a"/>
<path d="M300 150L334 137V283L300 296Z" fill="${S}"/><path d="M300 150L317 88L334 137Z" fill="${S}"/>${vLines(300, 334, 88, 296, 4, 0.1)}
<path d="M300 222L334 209" stroke="${TRIM}" stroke-width="2.6"/>
${sideWin(p, L, 317, 124, 10, 16, k)}${sideWin(p, L, 317, 180, 14, 22, k, { bars: [2, 3] })}${sideWin(p, L, 317, 252, 14, 22, k, { bars: [2, 3] })}
<clipPath id="${p}-roof"><path d="M156 154H306L320 86H170Z"/></clipPath>
<path d="M156 154H306L320 86H170Z" fill="#1d1e22"/>
<g clip-path="url(#${p}-roof)">${(() => { let d = ''; for (let y = 91; y < 154; y += 5.5) d += `M150 ${y}H330`; let v = ''; for (let y = 91, r = 0; y < 154; y += 5.5, r++) for (let x = 150 + (r % 2) * 5; x < 330; x += 10) v += `M${x} ${y}v5.5`; return `<path d="${d}" stroke="#2c2e33" stroke-width="1"/><path d="${v}" stroke="#2a2b30" stroke-width=".6"/>`; })()}</g>
<path d="M170 86H320" stroke="#141518" stroke-width="2.6"/>
<rect x="164" y="150" width="136" height="146" fill="${W}"/>${vLines(164, 300, 150, 296, 4, 0.12)}
<path d="M210 154V138L232 112L254 138V154Z" fill="${W}"/>${vLines(210, 254, 112, 154, 4, 0.12)}
<path d="M203 144L232 108L261 144" stroke="#1d1e22" stroke-width="7" fill="none" stroke-linejoin="round"/>
<path d="M207 141L232 110.5L257 141" stroke="${TRIM}" stroke-width="1.6" fill="none" stroke-linejoin="round"/>
${win(p, L, 222, 122, 20, 26, { bars: [2, 3] })}
<path d="M156 154H306" stroke="${TRIM}" stroke-width="1.8"/><path d="M297 152L317 86L337 136" stroke="${TRIM}" stroke-width="2.4" fill="none" stroke-linejoin="round"/>
<rect x="164" y="152" width="4" height="144" fill="${TRIM}"/><rect x="296" y="152" width="4" height="144" fill="${TRIM}"/><path d="M333.5 138V283" stroke="${TRIM}" stroke-width="1.8"/>
<rect x="164" y="220" width="136" height="3.2" fill="${TRIM}"/>
${win(p, L, 178, 166, 20, 30, { bars: [2, 3] })}${win(p, L, 266, 166, 20, 30, { bars: [2, 3] })}
${win(p, L, 174, 234, 22, 28, { bars: [2, 3] })}${win(p, L, 258, 234, 30, 28, { bars: [3, 3] })}
<path d="M216 236H248L244 230H220Z" fill="#1d1e22"/><path d="M215 236.5H249" stroke="${TRIM}" stroke-width="1.4"/>
<rect x="220" y="240" width="24" height="56" fill="${TRIM}"/><rect x="222" y="242" width="20" height="54" fill="#27303b"/>
<rect x="225" y="246" width="14" height="10" fill="${L ? `url(#${p}-lit)` : DARK}"/><circle cx="239" cy="270" r="1.1" fill="#c9ccd2"/>
<circle cx="214" cy="248" r="5" fill="#ffe2a0" opacity=".35" filter="url(#${p}-soft)"/><circle cx="214" cy="248" r="1.5" fill="#fff4d6"/>
<rect x="216" y="296" width="32" height="4" fill="#595c61"/>
<rect x="186.5" y="268" width="11" height="16" rx="1.4" fill="#c9ccd2"/><rect x="188.5" y="271" width="7" height="4" fill="#27313a"/><circle cx="192" cy="279.5" r="1.1" fill="#66d19e"/>
${tmark(HOUSES.sjo)}`;
  }

  const DRAW = { enebolig, rekkehus, gard, sjo };
  const styleOf = (s) => (HOUSES[s] ? s : 'enebolig');

  // Husets SVG. standalone = true gir en frittstående fil (xmlns, uten klasser som krever vår CSS).
  function svg(style, lightsOn, prefix, standalone) {
    const s = styleOf(style), p = prefix || `eh-${s}-${lightsOn ? 1 : 0}`;
    const attrs = standalone ? `xmlns="http://www.w3.org/2000/svg" viewBox="${HOUSES[s].vb}" width="760" height="680"` : `class="ehus-img" viewBox="${HOUSES[s].vb}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"`;
    return `<svg ${attrs}>${DRAW[s](p, !!lightsOn)}</svg>`;
  }
  const thumb = (style) => { const s = styleOf(style); return `<svg class="ehus-thumb" viewBox="${HOUSES[s].vb}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${DRAW[s](`eht-${s}`, true)}</svg>`; };

  // ---------- Overlay ----------
  const LABELS = [
    ['ev', 'Elbillader', 'var(--orange, #f2b573)'],
    ['grid', 'Nett', 'var(--blue, #73b9f2)'],
    ['home', 'Hjem', 'var(--yellow, #f2d26f)'],
    ['solar', 'Solceller', 'var(--lime, #b8e674)'],
    ['battery', 'Batteri', 'var(--green, #66d19e)'],
  ];
  const fmt = (v) => {
    if (v == null || v === '') return '–';
    if (typeof v !== 'number') return String(v);
    if (!isFinite(v)) return '–';
    const a = Math.abs(v);
    return a >= 1000 ? `${(v / 1000).toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW` : `${Math.round(v).toLocaleString('nb-NO')} W`;
  };
  const pt = (t) => (Array.isArray(t) && t.length === 2 && isFinite(+t[0]) && isFinite(+t[1]) ? [+t[0], +t[1]] : null);
  function targetsFor(style, targets) {
    const h = HOUSES[styleOf(style)], out = {};
    for (const [k] of LABELS) out[k] = pt(targets && targets[k]) || h[k] || null;
    return out;
  }
  // Justering: Elbillader høyrejustert, Hjem venstrejustert, Nett sentrert (høyrejustert når Hjem-linjen er < 70 unna)
  const anchorOf = (k, T) => (k === 'ev' ? 'end' : k === 'home' ? 'start' : k === 'grid' && T.home && Math.abs(T.home[0] - T.grid[0]) < 70 ? 'end' : 'middle');

  function overlay(s, o, T) {
    const vals = o.values || {}, labs = o.labels || {}, TOP = 52;
    let g = '', lines = '', dots = '', txt = '';
    for (const [k, name, col] of LABELS) {
      const t = T[k];
      if (!t) continue;
      if ((k === 'solar' || k === 'battery') && vals[k] == null) continue; // ekstra etiketter bare når de har verdi
      if (o.hide && o.hide[k]) continue; // skjult etikett (Tilpass energi → Hus): ingen tekst, linje eller prikk
      const [x, y] = t, a = anchorOf(k, T), id = `ehg-${s}-${k}`;
      g += `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x}" y1="${TOP}" x2="${x}" y2="${y}"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity=".12"/></linearGradient>`;
      lines += `<path class="ehus-line" data-k="${k}" d="M ${x},${TOP} V ${y}" stroke="url(#${id})" stroke-width="1" fill="none" vector-effect="non-scaling-stroke"/>`;
      dots += `<circle class="ehus-halo" cx="${x}" cy="${y}" r="7" fill="${col}" opacity=".22"/><circle class="ehus-dot" data-k="${k}" cx="${x}" cy="${y}" r="3" fill="${col}"/>`;
      txt += `<g class="ehus-lab" data-k="${k}" text-anchor="${a}"><text class="ehus-val" x="${x}" y="26">${esc(fmt(vals[k]))}</text>` +
        `<text class="ehus-name" x="${x}" y="43"><tspan fill="${col}" font-size="10" dy="-0.5">●</tspan><tspan dx="4" dy="0.5">${esc(labs[k] || name)}</tspan></text></g>`;
    }
    const kw = +o.kw || 0, run = o.flow !== false && kw > 0;
    const dur = Math.min(8, Math.max(0.6, 4 / kw)).toFixed(2); // hastighet ∝ kW
    const cable = o.cable || (o._customCable ? `M${T.grid[0]} ${T.grid[1]}L${T.ev[0]} ${T.ev[1]}` : HOUSES[s].cable);
    const kab = o.flow === false ? '' : `<path class="ehus-cable" d="${cable}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1.2" stroke-linejoin="round"/>` +
      (run ? `<path class="ehus-pulse" d="${cable}" pathLength="100" fill="none" stroke="var(--blue, #73b9f2)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="9 91" style="animation-duration:${dur}s"/>` : '');
    return `<svg class="ehus-ov" viewBox="${HOUSES[s].vb}" preserveAspectRatio="xMidYMid meet"><defs>${g}</defs>${kab}${lines}${dots}${txt}</svg>`;
  }

  const CSS = `.ehus{position:relative;width:100%;height:340px;font-family:inherit;overflow:hidden;background:radial-gradient(120% 70% at 50% 100%,rgba(115,185,242,.06),rgb(0 0 0 / 0) 70%);color:var(--ki-text, #fafafa)} /* nattscene = mørk øy (data-ki-island) i begge moduser */
.ehus-img,.ehus-ov{position:absolute;inset:0;width:100%;height:100%;display:block}
img.ehus-img{object-fit:contain;object-position:50% 50%}
.ehus-ov{overflow:visible;pointer-events:none}
.ehus-val{font-size:17px;font-weight:600;fill:var(--ki-text-1, #e1e1e1);font-variant-numeric:tabular-nums}
.ehus-name{font-size:12px;font-weight:500;fill:var(--ki-text-2, #afafaf)}
.ehus-pulse{animation:ehus-flow linear infinite;filter:drop-shadow(0 0 2.5px rgba(115,185,242,.9))}
@keyframes ehus-flow{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
@media (prefers-reduced-motion: reduce){.ehus-pulse{animation:none;stroke-dasharray:none;stroke-opacity:.5;filter:none}}
.ehus-thumb{display:block;width:100%;height:auto}`;

  // Eget bilde fra /local/ får ?v= (cache-bust), så en ny versjon ikke blir liggende i nettleserens cache
  const bust = (u) => (/^\/local\//.test(u) && !/[?#]/.test(u) ? `${u}?v=${encodeURIComponent(window.KI_MSH_VERSION || '1')}` : u);

  function html(o = {}) {
    const s = styleOf(o.style), custom = typeof o.custom_image === 'string' && o.custom_image.trim();
    const T = targetsFor(s, o.targets);
    const img = custom
      ? `<img class="ehus-img" src="${esc(bust(custom))}" alt="" draggable="false">`
      : svg(s, o.lightsOn);
    const ov = overlay(s, { ...o, _customCable: custom && o.targets && (o.targets.ev || o.targets.grid) }, T);
    return `<div class="ehus" data-ki-island data-style="${s}"${custom ? ' data-custom="1"' : ''}>${o.css === false ? '' : `<style>${M.theme ? M.theme.CSS : ''}${CSS}</style>`}${img}${ov}</div>`;
  }

  M.energiHus = { STYLES, NAMES, FILES, HOUSES, html, svg, thumb, targetsFor, fmt, CSS };
})();
