/**
 * Renderer: BuilderNode tree -> HTML string.
 *
 * This module is shared by all three consumers — the editor canvas, the
 * published site, and the .zip export — so what you see in the editor is what
 * ships. Keep it pure and DOM-free: it has to run in the browser and on the
 * server. `editor` mode only *adds* attributes and placeholders; it never
 * changes the markup structure, or the promise above would be a lie.
 */

import { compileCss, inLayer, BASE_CSS, LAYER_ORDER } from './css';
import { isContainer, type BuilderNode } from './types';
import { RUNTIME_JS } from './runtime';
import { WIDGETS } from './widgets';

export interface RenderOptions {
  /** Adds selection hooks and empty-state placeholders for the canvas. */
  editor?: boolean;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value);
}

/** Only tags we emit ourselves; never interpolated from untrusted props. */
const SAFE_TAG = /^[a-zA-Z][a-zA-Z0-9-]*$/;
function tagOf(value: unknown, fallback: string): string {
  const tag = String(value ?? '');
  return SAFE_TAG.test(tag) ? tag : fallback;
}

function attrString(node: BuilderNode, extra: Record<string, string | undefined> = {}): string {
  const attrs: Record<string, string> = { 'data-ws': node.id };

  for (const [key, value] of Object.entries(node.attrs ?? {})) {
    // `data-ws` is ours; a preserved attribute must not be able to shadow it.
    if (key === 'data-ws' || key === 'class' || key === 'style') continue;
    attrs[key] = value;
  }
  if (node.classes?.length) attrs.class = node.classes.join(' ');

  for (const [key, value] of Object.entries(extra)) {
    if (value == null || value === '') continue;
    // Widget classes add to preserved ones rather than replacing them.
    attrs[key] = key === 'class' && attrs.class ? `${attrs.class} ${value}` : value;
  }

  return Object.entries(attrs)
    .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
    .join(' ');
}

function renderChildren(node: BuilderNode, opts: RenderOptions): string {
  if (node.children.length === 0 && opts.editor && isContainer(node)) {
    return `<div class="ws-empty-hint" data-ws-placeholder="${node.id}">Drop a widget here</div>`;
  }
  return node.children.map((child) => renderNode(child, opts)).join('');
}

export function renderNode(node: BuilderNode, opts: RenderOptions = {}): string {
  const editorAttrs: Record<string, string | undefined> = opts.editor
    ? {
        'data-ws-type': node.type,
        'data-ws-empty': isContainer(node) && node.children.length === 0 ? 'true' : undefined,
      }
    : {};

  const open = (tag: string, extra: Record<string, string | undefined> = {}) =>
    `<${tag} ${attrString(node, { ...editorAttrs, ...extra })}>`;

  switch (node.type) {
    case 'section':
    case 'container': {
      const tag = tagOf(node.props.tag, node.type === 'section' ? 'section' : 'div');
      return `${open(tag)}${renderChildren(node, opts)}</${tag}>`;
    }

    case 'columns':
      return `${open('div')}${renderChildren(node, opts)}</div>`;

    case 'column':
      return `${open('div')}${renderChildren(node, opts)}</div>`;

    case 'heading': {
      const tag = tagOf(node.props.level, 'h2');
      return `${open(tag)}${escapeHtml(node.props.text)}</${tag}>`;
    }

    case 'text':
      // Rich text is authored by the site owner; emitted as-is by design.
      return `${open('div')}${String(node.props.html ?? '')}</div>`;

    case 'image': {
      const img = `<img ${attrString(node, {
        ...editorAttrs,
        src: String(node.props.src ?? ''),
        alt: String(node.props.alt ?? ''),
        loading: String(node.props.loading ?? 'lazy'),
      })}>`;
      const href = String(node.props.href ?? '');
      if (!href) return img;
      const target = String(node.props.target ?? '_self');
      const rel = target === '_blank' ? ' rel="noopener noreferrer"' : '';
      // The wrapper carries no `data-ws`: the image stays the selectable node.
      return `<a href="${escapeAttr(href)}" target="${escapeAttr(target)}"${rel}>${img}</a>`;
    }

    case 'button': {
      const href = String(node.props.href ?? '#');
      const target = String(node.props.target ?? '_self');
      const rel = target === '_blank' ? 'noopener noreferrer' : undefined;
      return `${open('a', { href, target, rel })}${escapeHtml(node.props.text)}</a>`;
    }

    case 'link': {
      const href = String(node.props.href ?? '#');
      const target = String(node.props.target ?? '_self');
      const rel = target === '_blank' ? 'noopener noreferrer' : undefined;
      return `${open('a', { href, target, rel })}${renderChildren(node, opts)}</a>`;
    }

    case 'icon': {
      const glyph = escapeHtml(node.props.glyph ?? '★');
      const href = String(node.props.href ?? '');
      if (href) return `${open('a', { href })}<span aria-hidden="true">${glyph}</span></a>`;
      return `${open('span', { 'aria-hidden': 'true' })}${glyph}</span>`;
    }

    case 'divider':
      return `<hr ${attrString(node, editorAttrs)}>`;

    case 'spacer':
      return `${open('div', { 'aria-hidden': 'true' })}</div>`;

    case 'html':
      return `${open('div')}${String(node.props.html ?? '')}</div>`;

    case 'slider':
      return renderSlider(node, open);

    case 'tabs':
      return renderTabs(node, open);

    case 'accordion':
      return renderAccordion(node, open);

    case 'counter': {
      const prefix = escapeHtml(node.props.prefix);
      const suffix = escapeHtml(node.props.suffix);
      const start = Number(node.props.start ?? 0);
      return `${open('div', {
        'data-ws-widget': 'counter',
        'data-start': String(start),
        'data-end': String(Number(node.props.end ?? 100)),
        'data-duration': String(Number(node.props.duration ?? 2000)),
      })}${prefix}<span data-counter-value>${escapeHtml(start)}</span>${suffix}</div>`;
    }

    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Dynamic widgets. Markup is static and accessible on its own; the runtime
// only enhances it, so a page still reads correctly with JS disabled.
// ---------------------------------------------------------------------------

type OpenFn = (tag: string, extra?: Record<string, string | undefined>) => string;

interface SlideItem {
  image?: string;
  heading?: string;
  text?: string;
}

function renderSlider(node: BuilderNode, open: OpenFn): string {
  const slides = (node.props.slides as SlideItem[]) ?? [];
  const showArrows = node.props.showArrows !== false;
  const showDots = node.props.showDots !== false;

  const slideMarkup = slides
    .map((slide, i) => {
      const img = slide.image
        ? `<img src="${escapeAttr(slide.image)}" alt="${escapeAttr(slide.heading ?? '')}" class="ws-slide-img">`
        : '';
      const heading = slide.heading ? `<h3 class="ws-slide-heading">${escapeHtml(slide.heading)}</h3>` : '';
      const text = slide.text ? `<p class="ws-slide-text">${escapeHtml(slide.text)}</p>` : '';
      return `<div class="ws-slide" data-slide="${i}"${i === 0 ? '' : ' hidden'} role="group" aria-roledescription="slide" aria-label="${i + 1} of ${slides.length}">${img}${heading}${text}</div>`;
    })
    .join('');

  const arrows = showArrows
    ? `<button type="button" class="ws-slider-prev" aria-label="Previous slide">‹</button><button type="button" class="ws-slider-next" aria-label="Next slide">›</button>`
    : '';

  const dots = showDots
    ? `<div class="ws-slider-dots" role="tablist">${slides
        .map(
          (_, i) =>
            `<button type="button" class="ws-slider-dot" data-goto="${i}" role="tab" aria-label="Go to slide ${i + 1}"${i === 0 ? ' aria-selected="true"' : ''}></button>`,
        )
        .join('')}</div>`
    : '';

  return `${open('div', {
    'data-ws-widget': 'slider',
    'data-autoplay': node.props.autoplay ? 'true' : 'false',
    'data-interval': String(Number(node.props.interval ?? 5000)),
    'data-loop': node.props.loop === false ? 'false' : 'true',
    class: 'ws-slider',
  })}<div class="ws-slider-track">${slideMarkup}</div>${arrows}${dots}</div>`;
}

interface PanelItem {
  title?: string;
  html?: string;
}

function renderTabs(node: BuilderNode, open: OpenFn): string {
  const items = (node.props.items as PanelItem[]) ?? [];
  const base = node.id;

  const buttons = items
    .map(
      (item, i) =>
        `<button type="button" class="ws-tab" role="tab" id="${escapeAttr(`${base}-tab-${i}`)}" aria-controls="${escapeAttr(`${base}-panel-${i}`)}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${escapeHtml(item.title ?? `Tab ${i + 1}`)}</button>`,
    )
    .join('');

  const panels = items
    .map(
      (item, i) =>
        `<div class="ws-tab-panel" role="tabpanel" id="${escapeAttr(`${base}-panel-${i}`)}" aria-labelledby="${escapeAttr(`${base}-tab-${i}`)}"${i === 0 ? '' : ' hidden'}>${String(item.html ?? '')}</div>`,
    )
    .join('');

  return `${open('div', { 'data-ws-widget': 'tabs', class: 'ws-tabs' })}<div class="ws-tab-list" role="tablist">${buttons}</div><div class="ws-tab-panels">${panels}</div></div>`;
}

function renderAccordion(node: BuilderNode, open: OpenFn): string {
  const items = (node.props.items as PanelItem[]) ?? [];
  const body = items
    .map(
      (item, i) =>
        `<div class="ws-accordion-item"><button type="button" class="ws-accordion-trigger" aria-expanded="false" aria-controls="${escapeAttr(`${node.id}-acc-${i}`)}">${escapeHtml(item.title ?? `Item ${i + 1}`)}<span class="ws-accordion-marker" aria-hidden="true">+</span></button><div class="ws-accordion-panel" id="${escapeAttr(`${node.id}-acc-${i}`)}" hidden>${String(item.html ?? '')}</div></div>`,
    )
    .join('');

  return `${open('div', {
    'data-ws-widget': 'accordion',
    'data-allow-multiple': node.props.allowMultiple ? 'true' : 'false',
    class: 'ws-accordion',
  })}${body}</div>`;
}

// ---------------------------------------------------------------------------
// Whole-document assembly
// ---------------------------------------------------------------------------

export function treeNeedsRuntime(node: BuilderNode): boolean {
  if (WIDGETS[node.type]?.needsRuntime) return true;
  return node.children.some(treeNeedsRuntime);
}

export interface SeoOptions {
  /** Meta description and og:description. */
  description?: string | null;
  /** og:image / twitter:image. */
  socialImage?: string | null;
  /** Absolute URL of this page, for rel=canonical and og:url. */
  canonical?: string | null;
  /** Emits robots noindex. */
  noIndex?: boolean;
  /** Favicon for the generated site, as a data URL or path. */
  favicon?: string | null;
  /** Human-readable site name, for og:site_name. */
  siteName?: string | null;
}

export interface DocumentOptions extends RenderOptions, SeoOptions {
  title: string;
  lang?: string;
  /** Stylesheet carried over from an imported template. */
  importedCss?: string | null;
  /** Project-level CSS written by the user. */
  customCss?: string | null;
  /** Extra markup injected into <head> (e.g. the canvas bridge script). */
  headExtra?: string;
  /** Extra markup injected before </body>. */
  bodyExtra?: string;
  /** Relative href of an external stylesheet instead of inline CSS (export). */
  stylesheetHref?: string;
  /** Relative src of the external runtime instead of inline JS (export). */
  runtimeSrc?: string;
}

/**
 * Builds the <head> metadata block.
 *
 * Social cards need og: and twitter: tags duplicated — no single tag is read
 * by every platform — so both are emitted from the same values rather than
 * relying on one falling back to the other.
 */
export function renderHead(opts: SeoOptions & { title: string }): string {
  const tags: string[] = [];
  const meta = (name: string, content: unknown) =>
    `<meta name="${name}" content="${escapeAttr(content)}">`;
  const property = (name: string, content: unknown) =>
    `<meta property="${name}" content="${escapeAttr(content)}">`;

  if (opts.description) {
    tags.push(meta('description', opts.description));
    tags.push(property('og:description', opts.description));
    tags.push(meta('twitter:description', opts.description));
  }

  tags.push(property('og:title', opts.title));
  tags.push(meta('twitter:title', opts.title));
  tags.push(property('og:type', 'website'));
  if (opts.siteName) tags.push(property('og:site_name', opts.siteName));

  if (opts.socialImage) {
    tags.push(property('og:image', opts.socialImage));
    tags.push(meta('twitter:image', opts.socialImage));
    // Without this, most clients render a small thumbnail instead of a card.
    tags.push(meta('twitter:card', 'summary_large_image'));
  } else {
    tags.push(meta('twitter:card', 'summary'));
  }

  if (opts.canonical) {
    tags.push(`<link rel="canonical" href="${escapeAttr(opts.canonical)}">`);
    tags.push(property('og:url', opts.canonical));
  }

  if (opts.noIndex) tags.push(meta('robots', 'noindex, nofollow'));
  if (opts.favicon) tags.push(`<link rel="icon" href="${escapeAttr(opts.favicon)}">`);

  return tags.join('\n');
}

/**
 * Splices the global header and footer around a page's own content.
 *
 * Producing one combined tree means CSS compilation, rendering and export all
 * work on globals with no special-casing — they are simply part of the
 * document by the time anything downstream sees them.
 */
export function composePage(
  page: BuilderNode,
  header?: BuilderNode | null,
  footer?: BuilderNode | null,
): BuilderNode {
  if (!header && !footer) return page;
  return {
    ...page,
    children: [...(header ? [header] : []), ...page.children, ...(footer ? [footer] : [])],
  };
}

export function renderDocument(root: BuilderNode, opts: DocumentOptions): string {
  const needsRuntime = treeNeedsRuntime(root);

  const styles = opts.stylesheetHref
    ? `<link rel="stylesheet" href="${escapeAttr(opts.stylesheetHref)}">`
    : `<style>\n${buildStylesheet(root, opts)}\n</style>`;

  let script = '';
  if (needsRuntime) {
    script = opts.runtimeSrc
      ? `<script src="${escapeAttr(opts.runtimeSrc)}" defer></script>`
      : `<script>\n${RUNTIME_JS}\n</script>`;
  }

  return `<!doctype html>
<html lang="${escapeAttr(opts.lang ?? 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
${renderHead(opts)}
${styles}
${opts.headExtra ?? ''}
</head>
<body>
${renderNode(root, { editor: opts.editor })}
${script}
${opts.bodyExtra ?? ''}
</body>
</html>`;
}

/** The full stylesheet for a page, in cascade order. */
export function buildStylesheet(root: BuilderNode, opts: Pick<DocumentOptions, 'importedCss' | 'customCss'>): string {
  return [
    LAYER_ORDER,
    inLayer('ws-base', `${BASE_CSS}\n${WIDGET_CSS}`),
    // Layered, so a per-element edit outranks it whatever its specificity.
    inLayer('ws-template', opts.importedCss),
    compileCss(root),
    // Unlayered and last: hand-written project CSS is the final say.
    opts.customCss ?? '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** Minimal presentation for the dynamic widgets, overridable by the user. */
export const WIDGET_CSS = `.ws-slider { position: relative; }
.ws-slider-track { position: relative; }
.ws-slide-img { display: block; width: 100%; height: auto; }
.ws-slider-prev, .ws-slider-next { position: absolute; top: 50%; transform: translateY(-50%); border: 0; background: rgba(0,0,0,.5); color: #fff; font-size: 24px; line-height: 1; width: 40px; height: 40px; cursor: pointer; border-radius: 50%; }
.ws-slider-prev { left: 12px; } .ws-slider-next { right: 12px; }
.ws-slider-dots { display: flex; gap: 8px; justify-content: center; padding: 12px 0; }
.ws-slider-dot { width: 10px; height: 10px; border-radius: 50%; border: 0; background: #c7c7c7; cursor: pointer; padding: 0; }
.ws-slider-dot[aria-selected="true"] { background: #444; }
.ws-tab-list { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 1px solid #e5e7eb; }
.ws-tab { border: 0; background: transparent; padding: 10px 16px; cursor: pointer; font: inherit; border-bottom: 2px solid transparent; }
.ws-tab[aria-selected="true"] { border-bottom-color: currentColor; font-weight: 600; }
.ws-tab-panel { padding: 16px 0; }
.ws-accordion-item { border-bottom: 1px solid #e5e7eb; }
.ws-accordion-trigger { display: flex; width: 100%; justify-content: space-between; align-items: center; gap: 16px; background: transparent; border: 0; padding: 16px 0; font: inherit; font-weight: 600; text-align: left; cursor: pointer; }
.ws-accordion-panel { padding-bottom: 16px; }
`;
