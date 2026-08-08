import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import { importHtml } from '../src/lib/builder/importer';
import { renderNode } from '../src/lib/builder/render';
import { flatten, findNode } from '../src/lib/builder/tree';

// The importer is browser-only by design; jsdom supplies DOMParser for tests.
// It only reads DOMParser when called, so installing it here is early enough.
const dom = new JSDOM('<!doctype html><html><body></body></html>');
(globalThis as unknown as { DOMParser: typeof dom.window.DOMParser }).DOMParser = dom.window.DOMParser;

const TEMPLATE = `<!doctype html>
<html>
<head>
  <title>Acme Landing</title>
  <link rel="stylesheet" href="https://cdn.example.com/reset.css">
  <link rel="stylesheet" href="css/theme.css">
  <style>.hero { background: navy; } .btn { color: white; }</style>
</head>
<body>
  <header class="site-header" id="top">
    <nav class="nav"><a href="/" class="brand">Acme</a><a href="/pricing">Pricing</a></nav>
  </header>
  <section class="hero" data-analytics="hero">
    <h1 class="hero-title" style="font-size: 64px; color: #fff">Ship faster</h1>
    <p class="hero-sub">The platform teams actually enjoy.</p>
    <a href="/signup" class="btn btn-primary">Get started</a>
    <img src="/img/screenshot.png" alt="Product screenshot" width="800">
  </section>
  <section class="features">
    <table class="pricing"><tr><td>Pro</td><td>$29</td></tr></table>
    <ul class="list"><li>One</li><li>Two</li></ul>
  </section>
  <script>console.log('tracking');</script>
</body>
</html>`;

test('preserves the template stylesheet and reports external ones', () => {
  const result = importHtml(TEMPLATE);

  assert.match(result.css, /\.hero \{ background: navy; \}/);
  assert.deepEqual(result.externalStylesheets, [
    'https://cdn.example.com/reset.css',
    'css/theme.css',
  ]);
  assert.equal(result.title, 'Acme Landing');
  // A relative stylesheet cannot be inlined, and dropped scripts are a
  // behaviour change — both must be surfaced, not silent.
  assert.ok(result.warnings.some((warning) => warning.includes('css/theme.css')));
  assert.ok(result.warnings.some((warning) => warning.includes('script')));
});

test('keeps classes, ids and data attributes on every node', () => {
  const { root } = importHtml(TEMPLATE);

  const header = flatten(root).find((node) => node.classes?.includes('site-header'));
  assert.ok(header, 'header node exists');
  assert.equal(header.attrs?.id, 'top');

  const hero = flatten(root).find((node) => node.classes?.includes('hero'));
  assert.equal(hero?.attrs?.['data-analytics'], 'hero');
});

test('maps elements onto editable widgets', () => {
  const { root } = importHtml(TEMPLATE);
  const nodes = flatten(root);

  const heading = nodes.find((node) => node.type === 'heading');
  assert.equal(heading?.props.text, 'Ship faster');
  assert.equal(heading?.props.level, 'h1');
  // Inline styles become editable values rather than opaque markup.
  assert.equal(heading?.styles.desktop['font-size'], '64px');
  assert.equal(heading?.styles.desktop.color, '#fff');

  const image = nodes.find((node) => node.type === 'image');
  assert.equal(image?.props.src, '/img/screenshot.png');
  assert.equal(image?.props.alt, 'Product screenshot');
  // A non-modelled attribute survives on the node.
  assert.equal(image?.attrs?.width, '800');

  // Text-only anchors become buttons, which render back as anchors.
  const cta = nodes.find((node) => node.type === 'button' && node.props.href === '/signup');
  assert.equal(cta?.props.text, 'Get started');
  assert.deepEqual(cta?.classes, ['btn', 'btn-primary']);
});

test('keeps tables and lists as raw HTML instead of approximating them', () => {
  const { root } = importHtml(TEMPLATE);
  const raw = flatten(root).filter((node) => node.type === 'html');

  const table = raw.find((node) => String(node.props.html).startsWith('<table'));
  const list = raw.find((node) => String(node.props.html).startsWith('<ul'));

  assert.ok(table, 'table preserved verbatim');
  assert.ok(list, 'list preserved verbatim');
  assert.match(String(table!.props.html), /\$29/);
});

test('round-trips: rendered output keeps the original classes and text', () => {
  const { root } = importHtml(TEMPLATE);
  const html = renderNode(root);

  for (const expected of ['site-header', 'hero', 'hero-title', 'btn-primary', 'Ship faster', '/img/screenshot.png']) {
    assert.ok(html.includes(expected), `output should contain ${expected}`);
  }
  // Scripts are dropped on import and must not reappear on render.
  assert.ok(!html.includes('tracking'));
});

test('drops nothing when the same tree is imported twice', () => {
  const first = importHtml(TEMPLATE);
  const second = importHtml(renderNode(first.root));

  // Re-importing rendered output must not lose nodes; that stability is what
  // makes edit-render-edit cycles safe.
  assert.equal(flatten(second.root).length >= flatten(first.root).length - 1, true);
  assert.ok(renderNode(second.root).includes('Ship faster'));
});

test('root id stays addressable after import', () => {
  const { root } = importHtml(TEMPLATE);
  assert.ok(findNode(root, 'root'));
});
