/**
 * Packs each template folder into an importable .zip.
 *
 * Output goes to public/templates/, where it is served as a static asset:
 * that is what lets the dashboard's template picker fetch one and run it
 * through the ordinary import pipeline, with no server-side special case and
 * nothing for the user to download. The same files double as the archives to
 * hand someone who would rather import by hand.
 *
 * Usage: node templates/build.mjs
 */

import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, '..', 'public', 'templates');

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

console.log(`\n${templates.length} templates written to public/templates/`);
