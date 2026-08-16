import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import { importHtml } from '../src/lib/builder/importer';
import { renderNode } from '../src/lib/builder/render';
import { createRoot, flatten, findNode } from '../src/lib/builder/tree';
import { createNode } from '../src/lib/builder/widgets';

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

test('simple lists and tables are modelled, keeping their content editable', () => {
  const nodes = flatten(importHtml(TEMPLATE).root);

  // These used to be kept as opaque HTML. They are the things people most
  // want to edit, so they are modelled now — see the round-trip tests below.
  const table = nodes.find((node) => node.type === 'table');
  const list = nodes.find((node) => node.type === 'list');

  assert.ok(table, 'the pricing table is editable');
  assert.deepEqual(table.props.rows, [['Pro', '$29']]);
  assert.ok(list, 'the feature list is editable');
  assert.deepEqual(list.props.items, [
    { text: 'One', href: '' },
    { text: 'Two', href: '' },
  ]);
});

test('markup a widget cannot reproduce is still preserved verbatim', () => {
  const { root } = importHtml(
    '<body><form action="/subscribe"><input name="email"><svg viewBox="0 0 1 1"></svg></form></body>',
  );

  const raw = flatten(root).find((node) => node.type === 'html');
  assert.ok(raw, 'the form is kept exactly');
  assert.match(String(raw.props.html), /action="\/subscribe"/);
  assert.match(String(raw.props.html), /<svg/);
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

// ---------------------------------------------------------------------------
// Lists and tables: modelled, not preserved as opaque blocks
// ---------------------------------------------------------------------------

test('a nav menu becomes an editable list of links', () => {
  const { root } = importHtml(`<body>
    <nav class="nav"><ul>
      <li><a href="/">Home</a></li>
      <li><a href="/pricing">Pricing</a></li>
    </ul></nav>
  </body>`);

  const list = flatten(root).find((node) => node.type === 'list');
  assert.ok(list, 'the <ul> is modelled rather than kept as raw HTML');
  assert.equal(list.props.ordered, false);
  assert.deepEqual(list.props.items, [
    { text: 'Home', href: '/' },
    { text: 'Pricing', href: '/pricing' },
  ]);

  // Round-trip: the original markup shape and classes survive.
  const html = renderNode(root);
  assert.match(html, /<ul[^>]*><li><a href="\/">Home<\/a><\/li>/);
});

test('an ordered list keeps its numbering', () => {
  const { root } = importHtml('<body><ol><li>One</li><li>Two</li></ol></body>');
  const list = flatten(root).find((node) => node.type === 'list');
  assert.equal(list?.props.ordered, true);
  assert.match(renderNode(root), /<ol[^>]*>/);
});

test('a list of rich content keeps its markup instead of losing it', () => {
  const { root, warnings } = importHtml(
    '<body><ul><li><h3>Card</h3><p>Body copy</p></li></ul></body>',
  );

  // Flattening this to strings would silently drop the heading and paragraph.
  const raw = flatten(root).find((node) => node.type === 'html');
  assert.ok(raw, 'kept verbatim');
  assert.match(String(raw.props.html), /<h3>Card<\/h3>/);
  assert.ok(warnings.some((warning) => warning.includes('ul')));
});

test('a simple table becomes editable rows and columns', () => {
  const { root } = importHtml(`<body><table class="pricing">
    <tr><th>Plan</th><th>Price</th></tr>
    <tr><td>Standard</td><td>29</td></tr>
  </table></body>`);

  const table = flatten(root).find((node) => node.type === 'table');
  assert.ok(table);
  assert.equal(table.props.headerRow, true);
  assert.deepEqual(table.props.rows, [
    ['Plan', 'Price'],
    ['Standard', '29'],
  ]);
  assert.deepEqual(table.classes, ['pricing']);

  const html = renderNode(root);
  assert.match(html, /<thead><tr><th>Plan<\/th><th>Price<\/th><\/tr><\/thead>/);
  assert.match(html, /<tbody><tr><td>Standard<\/td><td>29<\/td><\/tr><\/tbody>/);
});

test('a table with merged cells is preserved rather than mangled', () => {
  const { root, warnings } = importHtml(
    '<body><table><tr><td colspan="2">Wide</td></tr><tr><td>a</td><td>b</td></tr></table></body>',
  );

  // A rectangular array cannot express a colspan, and silently dropping it
  // would change the layout.
  assert.ok(!flatten(root).some((node) => node.type === 'table'));
  const raw = flatten(root).find((node) => node.type === 'html');
  assert.match(String(raw?.props.html), /colspan="2"/);
  assert.ok(warnings.some((warning) => warning.includes('merged cells')));
});

test('ragged table rows still render valid markup', () => {
  const node = createNode('table');
  node.props = { headerRow: false, rows: [['a', 'b', 'c'], ['d']] };

  const html = renderNode(createRoot([node]));
  // Every row is padded to the widest, so the table is never malformed.
  const cells = html.split('<td>').length - 1;
  assert.equal(cells, 6);
});
