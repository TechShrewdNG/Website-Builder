/**
 * HTML -> BuilderNode tree.
 *
 * Browser-only: it uses DOMParser rather than pulling in a server-side parser,
 * so import runs on the client and only the resulting tree is sent to the API.
 *
 * The guiding rule is *fidelity over modelling*. An imported page must look
 * identical before the user touches anything, so:
 *   - classes and attributes are preserved on every node;
 *   - the template's own <style> blocks are kept verbatim as project CSS;
 *   - inline `style` attributes become editable desktop styles;
 *   - anything with no faithful widget equivalent (tables, forms, svg, embeds)
 *     is kept as an `html` node holding its original markup, rather than being
 *     approximated into something that would render differently.
 */

import { emptyStyles, type BuilderNode, type StyleMap, type WidgetType } from './types';
import { createRoot } from './tree';
import { newId } from './widgets';

export interface ImportResult {
  root: BuilderNode;
  title: string;
  /** Contents of every inline <style> block, concatenated. */
  css: string;
  /** hrefs of <link rel="stylesheet">, which we cannot inline. */
  externalStylesheets: string[];
  /** Human-readable notes about anything that needed a judgement call. */
  warnings: string[];
}

/** Elements kept verbatim: modelling them would change how they render. */
const VERBATIM = new Set([
  'table', 'form', 'svg', 'video', 'audio', 'iframe', 'canvas', 'select',
  'textarea', 'input', 'button', 'ul', 'ol', 'dl', 'pre', 'blockquote',
  'figure', 'picture', 'object', 'embed', 'map', 'details',
]);

const SKIP = new Set(['script', 'style', 'link', 'meta', 'noscript', 'template', 'br', 'title']);

const CONTAINER_TAGS: Record<string, WidgetType> = {
  section: 'section',
  header: 'section',
  footer: 'section',
  main: 'section',
  div: 'container',
  article: 'container',
  aside: 'container',
  nav: 'container',
};

/** Inline elements that carry text but no layout of their own. */
const TEXTISH = new Set(['p', 'span', 'strong', 'em', 'small', 'label', 'time', 'address', 'q', 'cite', 'code']);

function parseInlineStyle(value: string | null): StyleMap {
  if (!value) return {};
  const out: StyleMap = {};
  for (const part of value.split(';')) {
    const index = part.indexOf(':');
    if (index < 0) continue;
    const prop = part.slice(0, index).trim().toLowerCase();
    const val = part.slice(index + 1).trim();
    if (prop && val) out[prop] = val;
  }
  return out;
}

function collectAttrs(el: Element): { classes?: string[]; attrs?: Record<string, string> } {
  const attrs: Record<string, string> = {};
  let classes: string[] | undefined;

  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name === 'class') {
      const list = attr.value.split(/\s+/).filter(Boolean);
      if (list.length) classes = list;
      continue;
    }
    // `style` becomes editable styles; these four are set by the renderer.
    if (['style', 'src', 'alt', 'href', 'target', 'loading', 'data-ws'].includes(name)) continue;
    attrs[name] = attr.value;
  }

  return {
    classes,
    attrs: Object.keys(attrs).length ? attrs : undefined,
  };
}

function makeNode(type: WidgetType, el: Element | null, props: Record<string, unknown>): BuilderNode {
  const styles = emptyStyles();
  const preserved = el ? collectAttrs(el) : {};
  if (el) styles.desktop = parseInlineStyle(el.getAttribute('style'));

  return {
    id: newId(),
    type,
    props,
    styles,
    ...preserved,
    children: [],
  };
}

function hasElementChildren(el: Element): boolean {
  return Array.from(el.childNodes).some(
    (child) => child.nodeType === 1 && !SKIP.has((child as Element).tagName.toLowerCase()),
  );
}

function convertElement(el: Element, warnings: string[]): BuilderNode | null {
  const tag = el.tagName.toLowerCase();
  if (SKIP.has(tag)) return null;

  if (VERBATIM.has(tag)) {
    // <button> is interactive but its markup is trivial to keep exactly.
    return makeNode('html', el, { html: el.outerHTML });
  }

  if (/^h[1-6]$/.test(tag)) {
    return makeNode('heading', el, { text: el.textContent?.trim() ?? '', level: tag });
  }

  if (tag === 'img') {
    return makeNode('image', el, {
      src: el.getAttribute('src') ?? '',
      alt: el.getAttribute('alt') ?? '',
      href: '',
      target: '_self',
      loading: el.getAttribute('loading') ?? 'lazy',
    });
  }

  if (tag === 'hr') return makeNode('divider', el, {});

  if (tag === 'a') {
    const href = el.getAttribute('href') ?? '#';
    const target = el.getAttribute('target') ?? '_self';
    if (!hasElementChildren(el)) {
      // A text-only anchor is exactly what the button widget renders, so it
      // round-trips byte-for-byte while becoming editable.
      return makeNode('button', el, { text: el.textContent?.trim() ?? '', href, target });
    }
    const node = makeNode('link', el, { href, target });
    node.children = convertChildren(el, warnings);
    return node;
  }

  if (TEXTISH.has(tag)) {
    if (!hasElementChildren(el)) {
      return makeNode('text', el, { html: `<${tag}>${el.innerHTML}</${tag}>` });
    }
    // Mixed content: keep the wrapper as a container and convert what's inside.
    const node = makeNode('container', el, { tag: tag === 'p' ? 'div' : 'div' });
    node.children = convertChildren(el, warnings);
    if (tag === 'p') warnings.push('A <p> containing block elements was converted to a container.');
    return node;
  }

  const containerType = CONTAINER_TAGS[tag];
  if (containerType) {
    const node = makeNode(containerType, el, {
      tag: containerType === 'section' ? tag : 'div',
      ...(containerType === 'section' ? { contentWidth: 'full', maxWidth: '1140px' } : {}),
    });
    node.children = convertChildren(el, warnings);
    return node;
  }

  // Unknown tag: preserve it rather than guess.
  warnings.push(`<${tag}> has no widget equivalent and was kept as raw HTML.`);
  return makeNode('html', el, { html: el.outerHTML });
}

function convertChildren(parent: Element, warnings: string[]): BuilderNode[] {
  const out: BuilderNode[] = [];

  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === 3) {
      const text = child.textContent ?? '';
      // Whitespace between tags is formatting, not content.
      if (!text.trim()) continue;
      out.push(makeNode('text', null, { html: `<p>${escapeText(text.trim())}</p>` }));
      continue;
    }
    if (child.nodeType !== 1) continue;

    const node = convertElement(child as Element, warnings);
    if (node) out.push(node);
  }

  return out;
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function importHtml(html: string): ImportResult {
  if (typeof DOMParser === 'undefined') {
    throw new Error('importHtml runs in the browser only');
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const warnings: string[] = [];

  const css = Array.from(doc.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n\n');

  const externalStylesheets = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => link.getAttribute('href') ?? '')
    .filter(Boolean);

  const relative = externalStylesheets.filter((href) => !/^https?:\/\//i.test(href));
  if (relative.length) {
    warnings.push(
      `${relative.length} stylesheet(s) are referenced by relative path (${relative.join(', ')}). ` +
        'Paste their contents into Project CSS, or the page will import unstyled.',
    );
  }
  if (doc.querySelector('script')) {
    warnings.push('Inline and external <script> tags were dropped. Re-add any you need via an HTML widget.');
  }

  const body = doc.body;
  const children = body ? convertChildren(body, warnings) : [];

  // Top-level content needs to live in sections for the layout controls to
  // make sense; loose widgets at the root get wrapped in one.
  const wrapped: BuilderNode[] = [];
  let loose: BuilderNode[] = [];
  const flush = () => {
    if (!loose.length) return;
    const section = makeNode('section', null, { tag: 'section', contentWidth: 'full', maxWidth: '1140px' });
    section.children = loose;
    wrapped.push(section);
    loose = [];
  };

  for (const child of children) {
    if (child.type === 'section') {
      flush();
      wrapped.push(child);
    } else {
      loose.push(child);
    }
  }
  flush();

  return {
    root: createRoot(wrapped),
    title: doc.title || 'Imported page',
    css,
    externalStylesheets,
    warnings: Array.from(new Set(warnings)),
  };
}
