/**
 * Packs each template folder into an importable .zip.
 *
 * The builder accepts a folder or a .zip; a .zip is the easier thing to hand
 * someone, so that is what ships. Output lands in templates/dist/, which is
 * gitignored — the sources are the artefact worth versioning, not the archives.
 *
 * Usage: node templates/build.mjs
 */

import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, 'dist');

function walk(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push({ path: relative(base, full).split(sep).join('/'), full });
  }
  return out;
}

mkdirSync(DIST, { recursive: true });

const templates = readdirSync(HERE)
  .filter((name) => statSync(join(HERE, name)).isDirectory() && name !== 'dist')
  .sort();

for (const name of templates) {
  const zip = new JSZip();
  const files = walk(join(HERE, name));
  for (const { path, full } of files) zip.file(path, readFileSync(full));

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const out = join(DIST, `${name}.zip`);
  writeFileSync(out, buffer);

  const pages = files.filter((f) => f.path.endsWith('.html')).length;
  console.log(`${name}.zip  ${pages} pages, ${files.length} files, ${(buffer.length / 1024).toFixed(0)} KB`);
}

console.log(`\n${templates.length} templates written to templates/dist/`);
