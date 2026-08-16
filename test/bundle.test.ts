import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import { importBundle, resolvePath, routeForFile, type BundleFile } from '../src/lib/builder/bundle';
import { flatten } from '../src/lib/builder/tree';

// The bundle importer is browser-only, like the parser it builds on.
const dom = new JSDOM('<!doctype html><html><body></body></html>');
(globalThis as unknown as { DOMParser: typeof dom.window.DOMParser }).DOMParser = dom.window.DOMParser;
(globalThis as unknown as { btoa: typeof dom.window.btoa }).btoa = (value: string) =>
  Buffer.from(value, 'binary').toString('base64');

function file(path: string, content: string, type = 'text/plain'): BundleFile {
  return { path, blob: new Blob([content], { type }) };
}

/** A one-pixel PNG, so image inlining is exercised on real bytes. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function imageFile(path: string): BundleFile {
  return { path, blob: new Blob([PNG_BYTES], { type: 'image/png' }) };
}

test('paths resolve the way a browser would', () => {
  assert.equal(resolvePath('index.html', 'img/a.png'), 'img/a.png');
  assert.equal(resolvePath('pages/about.html', '../img/a.png'), 'img/a.png');
  assert.equal(resolvePath('pages/about.html', './style.css'), 'pages/style.css');
  assert.equal(resolvePath('a/b/c.html', '../../top.css'), 'top.css');
});

test('file names map onto routes', () => {
  assert.equal(routeForFile('index.html'), '/');
  assert.equal(routeForFile('about.html'), '/about');
  assert.equal(routeForFile('docs/index.html'), '/docs');
  assert.equal(routeForFile('Our Team.html'), '/our-team');
});

test('a linked stylesheet is resolved and merged', async () => {
  const result = await importBundle([
    file('index.html', '<html><head><link rel="stylesheet" href="css/theme.css"></head><body><h1>Hi</h1></body></html>', 'text/html'),
    file('css/theme.css', '.hero { color: navy }'),
  ]);

  // Importing the .html alone leaves this unreachable, which is the whole
  // reason bundle import exists.
  assert.match(result.css, /\.hero \{ color: navy \}/);
  assert.equal(result.missing.length, 0);
});

test('local images are inlined and their references rewritten', async () => {
  const result = await importBundle([
    file('index.html', '<body><img src="img/shot.png" alt="Shot"></body>', 'text/html'),
    imageFile('img/shot.png'),
  ]);

  const image = flatten(result.pages[0].root).find((node) => node.type === 'image');
  assert.match(String(image?.props.src), /^data:image\/png;base64,/);
  assert.equal(result.resolvedAssets, 1);
  assert.equal(result.missing.length, 0);
});

test('url() references inside stylesheets are rewritten too', async () => {
  const result = await importBundle([
    file('index.html', '<html><head><link rel="stylesheet" href="css/theme.css"></head><body></body></html>', 'text/html'),
    file('css/theme.css', ".hero { background: url('../img/bg.png') }"),
    imageFile('img/bg.png'),
  ]);

  // The path is relative to the stylesheet, not the page that linked it.
  assert.match(result.css, /url\('data:image\/png;base64,/);
});

test('references that are genuinely missing are reported, not silently dropped', async () => {
  const result = await importBundle([
    file('index.html', '<html><head><link rel="stylesheet" href="css/missing.css"></head><body><img src="img/gone.png"></body></html>', 'text/html'),
  ]);

  const kinds = result.missing.map((entry) => `${entry.kind}:${entry.ref}`);
  assert.ok(kinds.includes('stylesheet:css/missing.css'));
  assert.ok(kinds.includes('image:img/gone.png'));

  // The path stays as written — the file may exist on the real server.
  const image = flatten(result.pages[0].root).find((node) => node.type === 'image');
  assert.equal(image?.props.src, 'img/gone.png');
});

test('absolute URLs are left alone rather than reported missing', async () => {
  const result = await importBundle([
    file(
      'index.html',
      '<html><head><link rel="stylesheet" href="https://cdn.example/reset.css"></head><body><img src="https://cdn.example/a.png"></body></html>',
      'text/html',
    ),
  ]);

  assert.deepEqual(result.externalStylesheets, ['https://cdn.example/reset.css']);
  assert.equal(result.missing.length, 0);
});

test('every html file becomes a page, with index first', async () => {
  const result = await importBundle([
    file('about.html', '<body><h1>About</h1></body>', 'text/html'),
    file('index.html', '<body><h1>Home</h1></body>', 'text/html'),
    file('docs/setup.html', '<body><h1>Setup</h1></body>', 'text/html'),
  ]);

  assert.deepEqual(
    result.pages.map((page) => page.path),
    ['/', '/about', '/docs/setup'],
  );
});

test('a shared stylesheet is only merged once across pages', async () => {
  const result = await importBundle([
    file('index.html', '<html><head><link rel="stylesheet" href="s.css"></head><body></body></html>', 'text/html'),
    file('about.html', '<html><head><link rel="stylesheet" href="s.css"></head><body></body></html>', 'text/html'),
    file('s.css', '.shared { color: red }'),
  ]);

  assert.equal(result.css.split('.shared').length - 1, 1);
});

test('files that would collide on one route are disambiguated', async () => {
  const result = await importBundle([
    file('index.html', '<body>a</body>', 'text/html'),
    file('Index.html', '<body>b</body>', 'text/html'),
  ]);

  const routes = result.pages.map((page) => page.path);
  assert.equal(new Set(routes).size, routes.length, 'routes are unique');
  assert.ok(result.warnings.some((warning) => warning.includes('share a route')));
});

test('an empty bundle reports rather than throwing', async () => {
  const result = await importBundle([file('readme.txt', 'nothing here')]);
  assert.equal(result.pages.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes('No .html')));
});
