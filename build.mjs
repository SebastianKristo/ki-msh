// Bygger dist/ki-msh.js: alle filer i src/ i navnerekkefølge, hver i egen blokk
// så én feil ikke stopper resten.
// Ytelse (Android): hver fil minifiseres for seg med esbuild (mellomrom/kommentarer/syntaks – navnene beholdes, så
// feilmeldinger i konsollen er lesbare). Toppteksten (banner, versjonssjekk, KI_MSH_VERSION) står uminifisert.
//   node build.mjs                → dist/ki-msh.js (minifisert – det er denne som er Lovelace-ressursen)
//   node build.mjs <fil>          → <fil> (minifisert; testene bygger slik)
//   node build.mjs --dev [<fil>]  → uminifisert (standard dist/ki-msh.dev.js) for feilsøking; også KI_MSH_DEV=1
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const args = process.argv.slice(2);
const dev = args.includes('--dev') || process.env.KI_MSH_DEV === '1';
const outArg = args.find((a) => !a.startsWith('--'));
let esbuild = null;
if (!dev) {
  try { esbuild = await import('esbuild'); } catch (e) {
    if (!outArg) { console.error('esbuild mangler – kjør «npm install» (eller bygg uminifisert med --dev)'); process.exit(1); }
    console.warn('(esbuild mangler – bygger uminifisert; kjør «npm install»)');
  }
}
// es2022: ingen senking av syntaks (klassefelt o.l. beholdes som i kilden – alle nettlesere HA støtter har dem)
const mini = (code, f) => {
  if (!esbuild) return code;
  try { return esbuild.transformSync(code, { minifyWhitespace: true, minifySyntax: true, target: 'es2022', legalComments: 'none', charset: 'utf8' }).code.trim(); } catch (e) { console.warn(`(${f}: minifisering feilet – tas med uminifisert) ${e.message.split('\n')[0]}`); return code; }
};
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
// Innebygde tredjepartskort (norsk kopi, src/vendor/*-no.js – ingen for tiden) først, så egne filer i navnerekkefølge
const vendor = (existsSync('src/vendor') ? readdirSync('src/vendor') : []).filter((f) => f.endsWith('-no.js')).sort().map((f) => 'vendor/' + f);
const files = [...vendor, ...readdirSync('src').filter((f) => f.endsWith('.js')).sort()];
let out = `/*! KI MSH ${pkg.version} – My SmartHome-dashbord for Home Assistant · https://github.com/SebastianKristo/ki-msh */\n`;
// Pakkeversjonen tilgjengelig for kortene (f.eks. console.info i 48-vaer.js)
// Fiks 28.14 · gammel bundel i cachen: to ulike versjoner lastet, eller ?v=<versjon> i ressurs-URL-en som ikke stemmer
// med bundelen → én advarsel i konsollen (ingen melding i UI-et).
const V = JSON.stringify(pkg.version);
out += `(function () { try {
  if (window.KI_MSH_VERSION && window.KI_MSH_VERSION !== ${V}) console.warn('[ki-msh] To versjoner er lastet (' + window.KI_MSH_VERSION + ' og ' + ${V} + '). Fjern den gamle Lovelace-ressursen og tøm cachen.');
  var cs = document.currentScript && document.currentScript.src; // klassisk <script>; som modul (HA-ressurs): ressurslisten
  var urls = cs ? [cs] : (performance.getEntriesByType ? performance.getEntriesByType('resource') : []).map(function (e) { return e.name; }).filter(function (u) { return /ki-msh(\\.min)?\\.js/.test(u); });
  var bad = urls.map(function (u) { try { return new URL(u, location.href).searchParams.get('v'); } catch (e) { return null; } }).filter(function (v) { return v && /^\\d+\\.\\d+/.test(v) && v !== ${V}; });
  if (bad.length) console.warn('[ki-msh] Ressurs-URL-en har ?v=' + bad[0] + ', men bundelen er ' + ${V} + ' – nettleseren/appen bruker en gammel kopi. Sett ?v=' + ${V} + ' på ressursen og tøm cachen (se README).');
} catch (e) { /* */ } })();\n`;
out += `window.KI_MSH_VERSION = ${V};\n`;
for (const f of files) {
  const src = readFileSync('src/' + f, 'utf8');
  // Hver fil i egen try/catch (én feil stopper ikke resten) – også etter minifisering
  out += `\n/* ---- ${f} ---- */\n` + mini(`try {\n${src}\n} catch (e) { console.error('[ki-msh] ${f}', e); }`, f) + '\n';
}
// Konsollmerket logges fra en tidsfrist (ikke toppnivået): med DevTools/automatisering tilkoblet fanger konsollen JS-stakken,
// og fra toppnivået krevde det ny parsing av hele bundelen for kildeposisjoner (~0,5 s med ×6 CPU-struping).
out += `\nsetTimeout(console.info, 0, '%c KI MSH %c ${pkg.version} ', 'background:#f285c9;color:#2a1720;font-weight:600;border-radius:4px 0 0 4px;padding:2px 4px', 'background:#3a3a3a;color:#fafafa;border-radius:0 4px 4px 0;padding:2px 4px');\n`;
const target = outArg || (dev ? 'dist/ki-msh.dev.js' : 'dist/ki-msh.js');
if (!outArg) mkdirSync('dist', { recursive: true });
writeFileSync(target, out);
const bytes = Buffer.byteLength(out);
console.log(`${target} · ${files.length} filer · ${(bytes / 1024).toFixed(0)} KB${esbuild ? ` minifisert (${(gzipSync(out).length / 1024).toFixed(0)} KB gzip)` : ' uminifisert'}`);
