/**
 * Import audit for the templates.
 *
 * Runs each template through the *real* client-side import pipeline (the same
 * unzip + importBundle the dashboard uses) and reports what the builder would
 * actually produce. The number that matters is `html` nodes: that widget is
 * the escape hatch for markup the importer cannot model, and anything landing
 * there is markup the user cannot edit with the normal controls. A template
 * that imports with zero `html` nodes is fully editable.
 *
 * Usage: node templates/audit.mjs [template-name]
 */

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import JSZip from 'jszip';

const HERE = dirname(fileURLToPath(import.meta.url));

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.DOMParser = dom.window.DOMParser;

const { importBundle } = await import('../src/lib/builder/bundle.ts');

function walk(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push({ path: relative(base, full).split(sep).join('/'), full });
  }
  return out;
}

function countTypes(node, counts = {}) {
  counts[node.type] = (counts[node.type] ?? 0) + 1;
  for (const child of node.children ?? []) countTypes(child, counts);
  return counts;
}

function collectHtmlNodes(node, found = []) {
  if (node.type === 'html') found.push(String(node.props?.html ?? '').replace(/\s+/g, ' ').slice(0, 90));
  for (const child of node.children ?? []) collectHtmlNodes(child, found);
  return found;
}

const only = process.argv[2];
const templates = readdirSync(HERE)
  .filter((name) => statSync(join(HERE, name)).isDirectory() && name !== 'dist')
  .filter((name) => !only || name === only)
  .sort();

let failures = 0;

for (const name of templates) {
  const dir = join(HERE, name);
  const files = walk(dir).map(({ path, full }) => ({ path, blob: new Blob([readFileSync(full)]) }));

  const result = await importBundle(files);

  const totals = {};
  for (const page of result.pages) countTypes(page.root, totals);
  const htmlNodes = result.pages.flatMap((page) => collectHtmlNodes(page.root));
  const totalNodes = Object.values(totals).reduce((sum, n) => sum + n, 0);

  console.log(`\n\x1b[1m${name}\x1b[0m`);
  console.log(`  pages          ${result.pages.length}  (${result.pages.map((p) => p.path).join(', ')})`);
  console.log(`  css            ${result.css.length} chars`);
  console.log(`  assets inlined ${result.resolvedAssets}`);
  console.log(`  nodes          ${totalNodes}`);
  console.log(
    `  widget mix     ${Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([type, n]) => `${type}:${n}`)
      .join('  ')}`,
  );

  if (result.missing.length) {
    failures += 1;
    console.log(`  \x1b[31mmissing refs   ${result.missing.length}\x1b[0m`);
    for (const entry of result.missing.slice(0, 8)) console.log(`      ${entry.kind}  ${entry.ref}  (from ${entry.from})`);
  } else {
    console.log(`  missing refs   \x1b[32mnone\x1b[0m`);
  }

  if (htmlNodes.length) {
    failures += 1;
    console.log(`  \x1b[31mraw html nodes ${htmlNodes.length}  (not editable as widgets)\x1b[0m`);
    for (const snippet of htmlNodes.slice(0, 8)) console.log(`      ${snippet}`);
  } else {
    console.log(`  raw html nodes \x1b[32mnone — fully editable\x1b[0m`);
  }

  if (result.warnings.length) {
    console.log(`  warnings:`);
    for (const warning of result.warnings) console.log(`      - ${warning}`);
  }
}

console.log('');
process.exit(failures ? 1 : 0);
