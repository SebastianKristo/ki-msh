// Fiks 34 (Del A) · teller gjenværende hardkodede farger per src-fil.
// Bruk: node test/hex-count.mjs [fil …] [--json] [--all] [--with-comments]
//   uten filer: alle src/*.js (ikke vendor/dist/design). --all viser også filer med 0.
// Teller fargene fra Del A «Fremgangsmåte» pkt. 2. Fallbacks inni en ki-token – `var(--ki-…, #hex)` –
// telles IKKE (de er mørk-fallback og hører til token-bruken). `var(--grayNNN, #hex)` telles (ikke token).
import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
export const PATTERNS = [
  ['#fafafa', /#fafafa\b/gi], ['#ffffff', /#ffffff\b/gi], ['#e1e1e1', /#e1e1e1\b/gi], ['#afafaf', /#afafaf\b/gi],
  ['#979797', /#979797\b/gi], ['#7f7f7f', /#7f7f7f\b/gi], ['#232323', /#232323\b/gi], ['#282828', /#282828\b/gi],
  ['#2f2f2f', /#2f2f2f\b/gi], ['#3a3a3a', /#3a3a3a\b/gi], ['#404040', /#404040\b/gi], ['#545454', /#545454\b/gi],
  ['rgba(255,255,255,', /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,/gi], ['rgba(0,0,0,', /rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/gi],
];

// Fjern `var(--ki-xxx, <fallback>)` (med nøstede parenteser i fallback) før telling
export function stripKiFallbacks(src) {
  let out = '', i = 0;
  const re = /var\(\s*--ki-[\w-]+\s*,/g;
  let m;
  while ((m = re.exec(src))) {
    out += src.slice(i, m.index);
    let depth = 1, j = m.index + m[0].length;
    while (j < src.length && depth > 0) { const c = src[j]; if (c === '(') depth++; else if (c === ')') depth--; j++; }
    out += 'var(--ki-token)';
    i = j; re.lastIndex = j;
  }
  return out + src.slice(i);
}

// Kommentarer (// … og /* … */) og linjer merket «ki-hex-ok» (bevisste unntak: fargepaletter, kamera-flate, sveip-rød)
// telles ikke. --with-comments teller kommentarene også.
export function stripComments(src) {
  const keep = src.split('\n').map((l) => (/ki-hex-ok/.test(l) ? '' : l)).join('\n');
  return keep.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');
}
const WITH_COMMENTS = process.argv.includes('--with-comments');
export function countFile(path) {
  let src = readFileSync(path, 'utf8');
  if (!WITH_COMMENTS) src = stripComments(src);
  src = stripKiFallbacks(src);
  const per = {}; let total = 0;
  for (const [name, re] of PATTERNS) { const n = (src.match(re) || []).length; per[name] = n; total += n; }
  return { file: basename(path), total, per };
}

const args = process.argv.slice(2);
const json = args.includes('--json'), all = args.includes('--all');
const named = args.filter((a) => !a.startsWith('--'));
const files = (named.length ? named.map((f) => f.replace(/^src\//, '')) : readdirSync(SRC).filter((f) => f.endsWith('.js') && f !== '00-a-theme.js').sort());
const rows = files.map((f) => countFile(join(SRC, f))).filter((r) => all || named.length || r.total);
if (json) { console.log(JSON.stringify(rows, null, 1)); process.exit(0); }
const short = PATTERNS.map(([n]) => n.replace('rgba(255,255,255,', 'w-rgba').replace('rgba(0,0,0,', 'k-rgba'));
const w = Math.max(14, ...rows.map((r) => r.file.length));
console.log('fil'.padEnd(w) + ' | total | ' + short.map((s) => s.padStart(7)).join(' '));
console.log('-'.repeat(w + 10 + short.length * 8));
let sum = 0;
for (const r of rows) { sum += r.total; console.log(r.file.padEnd(w) + ' | ' + String(r.total).padStart(5) + ' | ' + PATTERNS.map(([n]) => String(r.per[n] || '').padStart(7)).join(' ')); }
console.log('-'.repeat(w + 10 + short.length * 8));
console.log('SUM'.padEnd(w) + ' | ' + String(sum).padStart(5) + ' |');
