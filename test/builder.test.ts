import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

import { compileCss } from '../src/lib/builder/css';
import { buildExport, outputPathFor } from '../src/lib/builder/export';
import { renderDocument, renderNode } from '../src/lib/builder/render';
import { createNode } from '../src/lib/builder/widgets';
import { createRoot, findNode, flatten, insertNode, moveNode, removeNode, setProps, setStyle } from '../src/lib/builder/tree';
import type { BuilderNode } from '../src/lib/builder/types';

// ---------------------------------------------------------------------------
// Tree operations
// ---------------------------------------------------------------------------

test('structural rules reject drops that would corrupt layout', () => {
  const columns = createNode('columns');
  const root = createRoot([columns]);

  // A columns row holds only columns.
  const heading = createNode('heading');
  assert.equal(insertNode(root, columns.id, heading, 0), root, 'heading rejected by columns row');

  // ...but the columns it created do accept content.
  const column = columns.children[0];
  const withHeading = insertNode(root, column.id, heading, 0);
  assert.ok(findNode(withHeading, heading.id));
});

test('a node cannot be moved inside its own subtree', () => {
  const inner = createNode('container');
  const outer = createNode('container', { children: [inner] });
  const root = createRoot([createNode('section', { children: [outer] })]);

  const result = moveNode(root, outer.id, inner.id, 0);
  assert.equal(result, root, 'move is refused');
  // The branch is still reachable, i.e. nothing was detached.
  assert.ok(findNode(root, inner.id));
});

test('reordering within one parent lands where the indicator pointed', () => {
  const a = createNode('heading');
  const b = createNode('heading');
  const c = createNode('heading');
  const section = createNode('section', { children: [a, b, c] });
  const root = createRoot([section]);

  // Move the first child to the end.
  const moved = moveNode(root, a.id, section.id, 3);
  const order = findNode(moved, section.id)!.children.map((child) => child.id);
  assert.deepEqual(order, [b.id, c.id, a.id]);
});

test('changing the column count adds and removes real columns', () => {
  const columns = createNode('columns');
  const root = createRoot([columns]);
  assert.equal(columns.children.length, 2);

  const widened = setProps(root, columns.id, { count: 4 });
  assert.equal(findNode(widened, columns.id)!.children.length, 4);

  const narrowed = setProps(widened, columns.id, { count: 1 });
  assert.equal(findNode(narrowed, columns.id)!.children.length, 1);
});

test('clearing a style removes the declaration so inherited rules apply again', () => {
  const heading = createNode('heading');
  const root = createRoot([heading]);

  const styled = setStyle(root, heading.id, 'desktop', { color: 'red' });
  assert.match(compileCss(styled), /color: red/);

  const cleared = setStyle(styled, heading.id, 'desktop', { color: '' });
  assert.ok(!compileCss(cleared).includes('color: red'));
});

test('removing a node takes its whole subtree with it', () => {
  const child = createNode('heading');
  const container = createNode('container', { children: [child] });
  const root = createRoot([createNode('section', { children: [container] })]);

  const pruned = removeNode(root, container.id);
  assert.equal(findNode(pruned, child.id), null);
});

// ---------------------------------------------------------------------------
// CSS compilation
// ---------------------------------------------------------------------------

test('breakpoint styles compile into media queries in cascade order', () => {
  const heading = createNode('heading');
  let root: BuilderNode = createRoot([heading]);
  root = setStyle(root, heading.id, 'desktop', { 'font-size': '48px' });
  root = setStyle(root, heading.id, 'tablet', { 'font-size': '32px' });
  root = setStyle(root, heading.id, 'mobile', { 'font-size': '24px' });

  const css = compileCss(root);
  const desktopAt = css.indexOf('48px');
  const tabletAt = css.indexOf('@media (max-width: 1024px)');
  const mobileAt = css.indexOf('@media (max-width: 767px)');

  assert.ok(desktopAt > -1 && tabletAt > -1 && mobileAt > -1);
  // Narrower queries must come last or they would be overridden.
  assert.ok(desktopAt < tabletAt && tabletAt < mobileAt);
});

test('structural styles are emitted even when the user sets none', () => {
  const columns = createNode('columns');
  const css = compileCss(createRoot([columns]));

  assert.match(css, /display: flex/);
  // Stacking on mobile is the default and must survive into the media query.
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*flex-direction: column/);
});

// ---------------------------------------------------------------------------
// Rendering and escaping
// ---------------------------------------------------------------------------

test('text content is escaped but rich text is not', () => {
  const heading = createNode('heading');
  const root = setProps(createRoot([heading]), heading.id, { text: '<script>alert(1)</script>' });

  const html = renderNode(root);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
});

test('external links get rel="noopener"', () => {
  const button = createNode('button');
  const root = setProps(createRoot([button]), button.id, { href: 'https://example.com', target: '_blank' });
  assert.match(renderNode(root), /rel="noopener noreferrer"/);
});

test('editor mode adds hooks without changing the shipped structure', () => {
  const section = createNode('section', { children: [createNode('heading')] });
  const root = createRoot([section]);

  const shipped = renderNode(root);
  const editing = renderNode(root, { editor: true });

  assert.ok(editing.includes('data-ws-type='), 'editor adds type hints');
  assert.ok(!shipped.includes('data-ws-type='), 'exports stay clean');
  // Same tags, same order — only attributes differ.
  assert.deepEqual(tagSequence(shipped), tagSequence(editing));
});

function tagSequence(html: string): string[] {
  return Array.from(html.matchAll(/<([a-z][a-z0-9]*)\b/g)).map((match) => match[1]);
}

// ---------------------------------------------------------------------------
// Dynamic widgets: markup, accessibility, and the runtime
// ---------------------------------------------------------------------------

test('dynamic widgets render usable markup before any JS runs', () => {
  for (const type of ['slider', 'tabs', 'accordion', 'counter'] as const) {
    const node = createNode(type);
    const html = renderNode(createRoot([node]));
    assert.ok(html.includes(`data-ws-widget="${type}"`), `${type} is tagged for the runtime`);
  }

  const tabs = renderNode(createRoot([createNode('tabs')]));
  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /role="tabpanel"/);
  assert.match(tabs, /aria-selected="true"/);

  const accordion = renderNode(createRoot([createNode('accordion')]));
  assert.match(accordion, /aria-expanded="false"/);
  assert.match(accordion, /aria-controls=/);
});

test('the runtime wires up tabs and accordions in a real DOM', async () => {
  const document = renderDocument(createRoot([createNode('tabs'), createNode('accordion')]), {
    title: 'Runtime test',
  });

  const dom = new JSDOM(document, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { window } = dom;
  await new Promise((resolve) => window.addEventListener('load', resolve));

  const tabs = window.document.querySelectorAll('.ws-tab');
  const panels = window.document.querySelectorAll('.ws-tab-panel');
  assert.equal(panels[1].hasAttribute('hidden'), true, 'second panel starts hidden');

  (tabs[1] as HTMLElement).click();
  assert.equal(panels[1].hasAttribute('hidden'), false, 'clicking a tab reveals its panel');
  assert.equal(panels[0].hasAttribute('hidden'), true, 'the previous panel hides');
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');

  const trigger = window.document.querySelector('.ws-accordion-trigger') as HTMLElement;
  const panel = window.document.getElementById(trigger.getAttribute('aria-controls')!)!;
  assert.equal(panel.hasAttribute('hidden'), true);
  trigger.click();
  assert.equal(panel.hasAttribute('hidden'), false, 'accordion opens');
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');

  window.close();
});

test('re-running the runtime does not double-bind listeners', async () => {
  const document = renderDocument(createRoot([createNode('accordion')]), { title: 'Idempotent' });
  const dom = new JSDOM(document, { runScripts: 'dangerously', pretendToBeVisual: true });
  const { window } = dom;
  await new Promise((resolve) => window.addEventListener('load', resolve));

  // The editor canvas calls wsBoot() after every render.
  (window as unknown as { wsBoot: () => void }).wsBoot();
  (window as unknown as { wsBoot: () => void }).wsBoot();

  const trigger = window.document.querySelector('.ws-accordion-trigger') as HTMLElement;
  const panel = window.document.getElementById(trigger.getAttribute('aria-controls')!)!;

  trigger.click();
  // With a duplicate listener the panel would toggle twice and stay shut.
  assert.equal(panel.hasAttribute('hidden'), false, 'one click still opens the panel');

  window.close();
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

test('pages map onto clean-URL paths', () => {
  assert.equal(outputPathFor('/'), 'index.html');
  assert.equal(outputPathFor('/about'), 'about/index.html');
  assert.equal(outputPathFor('/legal/terms'), 'legal/terms/index.html');
});

test('nested pages reference shared assets by relative path', () => {
  const files = buildExport({
    name: 'Test site',
    pages: [
      { title: 'Home', path: '/', tree: createRoot([createNode('heading')]) },
      { title: 'About', path: '/about', tree: createRoot([createNode('tabs')]) },
    ],
  });

  assert.ok(files['index.html'], 'home page written');
  assert.ok(files['about/index.html'], 'nested page written');
  assert.ok(files['assets/styles.css'], 'shared stylesheet written');
  assert.ok(files['assets/builder.js'], 'runtime written because a page needs it');

  assert.match(String(files['index.html']), /href="assets\/styles\.css"/);
  assert.match(String(files['about/index.html']), /href="\.\.\/assets\/styles\.css"/);
  assert.match(String(files['about/index.html']), /src="\.\.\/assets\/builder\.js"/);
});

test('the runtime ships only when a dynamic widget is present', () => {
  const files = buildExport({
    name: 'Static site',
    pages: [{ title: 'Home', path: '/', tree: createRoot([createNode('heading')]) }],
  });
  assert.equal(files['assets/builder.js'], undefined);
  assert.ok(!String(files['index.html']).includes('builder.js'));
});

test('data-URL images become real files, deduplicated', () => {
  const pixel =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  const first = createNode('image');
  first.props.src = pixel;
  const second = createNode('image');
  second.props.src = pixel;

  const files = buildExport({
    name: 'Image site',
    pages: [{ title: 'Home', path: '/', tree: createRoot([first, second]) }],
  });

  const images = Object.keys(files).filter((path) => path.startsWith('assets/images/'));
  assert.equal(images.length, 1, 'the same image is written once');
  assert.match(images[0], /\.png$/);
  assert.ok(files[images[0]] instanceof Uint8Array, 'written as binary, not text');

  const html = String(files['index.html']);
  assert.ok(!html.includes('data:image/png'), 'the data URL is gone from the markup');
  assert.match(html, /src="assets\/images\/img-1\.png"/);
});

test('imported template CSS survives export, ahead of generated rules', () => {
  const heading = createNode('heading');
  let tree: BuilderNode = createRoot([heading]);
  tree = setStyle(tree, heading.id, 'desktop', { color: 'rebeccapurple' });

  const files = buildExport({
    name: 'Imported',
    importedCss: '.legacy { color: teal; }',
    customCss: '.mine { color: gold; }',
    pages: [{ title: 'Home', path: '/', tree }],
  });

  const css = String(files['assets/styles.css']);
  assert.ok(css.includes('.legacy { color: teal; }'));
  assert.ok(css.includes('.mine { color: gold; }'));
  // Generated rules must sit after the template's own, so edits win.
  assert.ok(css.indexOf('.legacy') < css.indexOf('rebeccapurple'));
  assert.ok(css.indexOf('rebeccapurple') < css.indexOf('.mine'));
});

test('every node in an exported page is addressable by its generated CSS', () => {
  const tree = createRoot([
    createNode('section', { children: [createNode('heading'), createNode('button')] }),
  ]);
  const css = compileCss(tree);

  for (const node of flatten(tree)) {
    if (Object.values(node.styles).every((map) => Object.keys(map).length === 0)) continue;
    assert.ok(css.includes(`[data-ws="${node.id}"]`), `${node.type} has a rule`);
  }
});

test('editor preview flattens breakpoints instead of relying on iframe width', () => {
  const heading = createNode('heading');
  let tree: BuilderNode = createRoot([heading]);
  tree = setStyle(tree, heading.id, 'desktop', { 'font-size': '48px' });
  tree = setStyle(tree, heading.id, 'mobile', { 'font-size': '20px' });

  // The canvas is narrower than a real viewport, so a media query would fire
  // on the iframe's width and show mobile styles under "desktop".
  const desktop = compileCss(tree, { flattenTo: 'desktop' });
  assert.ok(!desktop.includes('@media'), 'no media queries in preview output');
  assert.ok(desktop.includes('48px'));
  assert.ok(!desktop.includes('20px'), 'mobile value must not leak into desktop preview');

  // Narrower breakpoints still inherit from wider ones, last one winning.
  const mobile = compileCss(tree, { flattenTo: 'mobile' });
  assert.ok(mobile.indexOf('48px') < mobile.indexOf('20px'));

  // Export and publish keep real media queries.
  assert.match(compileCss(tree), /@media \(max-width: 767px\)/);
});

test('template CSS is layered so a per-element edit always wins', () => {
  const heading = createNode('heading');
  let tree: BuilderNode = createRoot([heading]);
  tree = setStyle(tree, heading.id, 'desktop', { 'font-size': '30px' });

  const files = buildExport({
    name: 'Layered',
    // (0,1,1) — more specific than the generated [data-ws="…"] at (0,1,0),
    // so without layers the template would win and edits would appear to do
    // nothing.
    importedCss: '.hero h1 { font-size: 56px; }',
    pages: [{ title: 'Home', path: '/', tree }],
  });

  const css = String(files['assets/styles.css']);
  assert.ok(css.startsWith('@layer ws-base, ws-template;'), 'layer order declared first');
  assert.match(css, /@layer ws-template \{[\s\S]*\.hero h1[\s\S]*\}/);
  // The generated rule must sit outside any layer.
  const generatedAt = css.indexOf(`[data-ws="${heading.id}"]`);
  const templateEndsAt = css.indexOf('@layer ws-template');
  assert.ok(generatedAt > templateEndsAt, 'generated rules come after, unlayered');
});
