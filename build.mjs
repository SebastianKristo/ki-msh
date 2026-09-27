// Bygger dist/ki-msh.js: alle filer i src/ i navnerekkefølge, hver i egen blokk
// så én feil ikke stopper resten.
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
// Innebygde tredjepartskort (norsk kopi) først, så egne filer i navnerekkefølge
const vendor = readdirSync('src/vendor').filter((f) => f.endsWith('-no.js')).sort().map((f) => 'vendor/' + f);
const files = [...vendor, ...readdirSync('src').filter((f) => f.endsWith('.js')).sort()];
let out = `/*! KI MSH ${pkg.version} – My SmartHome-dashbord for Home Assistant · https://github.com/SebastianKristo/ki-msh */\n`;
// Pakkeversjonen tilgjengelig for kortene (f.eks. console.info i 48-vaer.js)
out += `window.KI_MSH_VERSION = ${JSON.stringify(pkg.version)};\n`;
for (const f of files) {
  const src = readFileSync('src/' + f, 'utf8');
  out += `\n/* ---- ${f} ---- */\ntry {\n${src}\n} catch (e) { console.error('[ki-msh] ${f}', e); }\n`;
}
out += `\nconsole.info('%c KI MSH %c ${pkg.version} ', 'background:#f285c9;color:#2a1720;font-weight:600;border-radius:4px 0 0 4px;padding:2px 4px', 'background:#3a3a3a;color:#fafafa;border-radius:0 4px 4px 0;padding:2px 4px');\n`;
const target = process.argv[2] || 'dist/ki-msh.js';
if (!process.argv[2]) mkdirSync('dist', { recursive: true });
writeFileSync(target, out);
console.log(`${target} · ${files.length} filer · ${(out.length / 1024).toFixed(0)} KB`);
