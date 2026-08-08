/**
 * Static-site export: project + pages -> a file map ready to be zipped.
 *
 * The output is a plain static site with no dependency on this app: open
 * index.html from disk and it works. Two things make that true — data-URL
 * images are extracted back into real files, and the shared stylesheet and
 * runtime are referenced by relative path from each page's depth.
 */

import { buildStylesheet, composePage, renderDocument, treeNeedsRuntime, WIDGET_CSS } from './render';
import { compileCss, inLayer, BASE_CSS, LAYER_ORDER } from './css';
import { RUNTIME_JS } from './runtime';
import type { BuilderNode } from './types';

export interface ExportPage {
  title: string;
  path: string;
  tree: BuilderNode;
  description?: string | null;
  socialImage?: string | null;
  noIndex?: boolean;
}

export interface ExportInput {
  name: string;
  pages: ExportPage[];
  importedCss?: string | null;
  customCss?: string | null;
  externalStylesheets?: string[];
  header?: BuilderNode | null;
  footer?: BuilderNode | null;
  favicon?: string | null;
  /** Site origin, e.g. https://example.com — enables canonical URLs and a sitemap. */
  baseUrl?: string | null;
}

export type FileMap = Record<string, string | Uint8Array>;

/** "/" -> index.html, "/about" -> about/index.html (clean URLs on any host). */
export function outputPathFor(pagePath: string): string {
  const clean = pagePath.replace(/^\/+|\/+$/g, '');
  return clean === '' ? 'index.html' : `${clean}/index.html`;
}

/** How many "../" steps a page needs to reach the site root. */
function prefixFor(outputPath: string): string {
  const depth = outputPath.split('/').length - 1;
  return depth === 0 ? '' : '../'.repeat(depth);
}

const DATA_URL = /^data:([^;,]+)(;base64)?,(.*)$/s;

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

/**
 * Replaces data-URL image sources with files under assets/images/, so the
 * exported HTML stays readable and the browser can cache images separately.
 * Returns the rewritten tree plus the files to write.
 */
function extractImages(
  tree: BuilderNode,
  files: FileMap,
  seen: Map<string, string>,
): BuilderNode {
  const next: BuilderNode = { ...tree, props: { ...tree.props } };

  const rewrite = (value: unknown): unknown => {
    if (typeof value !== 'string') return value;
    const match = DATA_URL.exec(value);
    if (!match) return value;

    const cached = seen.get(value);
    if (cached) return cached;

    const [, mime, base64, payload] = match;
    const extension = EXTENSIONS[mime] ?? 'bin';
    const filename = `assets/images/img-${seen.size + 1}.${extension}`;

    files[filename] = base64
      ? Uint8Array.from(Buffer.from(payload, 'base64'))
      : decodeURIComponent(payload);

    seen.set(value, filename);
    return filename;
  };

  if (next.type === 'image') next.props.src = rewrite(next.props.src);
  if (next.type === 'slider' && Array.isArray(next.props.slides)) {
    next.props.slides = (next.props.slides as Record<string, unknown>[]).map((slide) => ({
      ...slide,
      image: rewrite(slide.image),
    }));
  }

  next.children = tree.children.map((child) => extractImages(child, files, seen));
  return next;
}

/**
 * Image paths written by extractImages are root-relative to the export, but
 * a page nested one level down needs "../" in front of them.
 */
function prefixImagePaths(tree: BuilderNode, prefix: string): BuilderNode {
  if (!prefix) return tree;
  const fix = (value: unknown) =>
    typeof value === 'string' && value.startsWith('assets/images/') ? prefix + value : value;

  const next: BuilderNode = { ...tree, props: { ...tree.props } };
  if (next.type === 'image') next.props.src = fix(next.props.src);
  if (next.type === 'slider' && Array.isArray(next.props.slides)) {
    next.props.slides = (next.props.slides as Record<string, unknown>[]).map((slide) => ({
      ...slide,
      image: fix(slide.image),
    }));
  }
  next.children = tree.children.map((child) => prefixImagePaths(child, prefix));
  return next;
}

export function buildExport(input: ExportInput): FileMap {
  const files: FileMap = {};
  const seen = new Map<string, string>();

  const pages = input.pages.map((page) => ({
    ...page,
    tree: extractImages(page.tree, files, seen),
  }));

  // Globals go through the same image extraction, once for the whole site.
  const header = input.header ? extractImages(input.header, files, seen) : null;
  const footer = input.footer ? extractImages(input.footer, files, seen) : null;

  // One stylesheet for the whole site: node ids are unique across pages, so
  // combining is safe and lets the browser cache it once.
  const siteCss = [
    LAYER_ORDER,
    inLayer('ws-base', `${BASE_CSS}\n${WIDGET_CSS}`),
    inLayer('ws-template', input.importedCss),
    // Globals are compiled once, not per page: their node ids are shared, so
    // compiling them with each page would emit the same rules N times.
    header ? compileCss(header) : '',
    footer ? compileCss(footer) : '',
    ...pages.map((page) => compileCss(page.tree)),
    input.customCss ?? '',
  ]
    .filter(Boolean)
    .join('\n\n');

  files['assets/styles.css'] = siteCss;

  const anyRuntime =
    pages.some((page) => treeNeedsRuntime(page.tree)) ||
    Boolean(header && treeNeedsRuntime(header)) ||
    Boolean(footer && treeNeedsRuntime(footer));
  if (anyRuntime) files['assets/builder.js'] = RUNTIME_JS;

  const externalLinks = (input.externalStylesheets ?? [])
    .filter((href) => /^https?:\/\//i.test(href))
    .map((href) => `<link rel="stylesheet" href="${href.replace(/"/g, '&quot;')}">`)
    .join('\n');

  const baseUrl = (input.baseUrl ?? '').replace(/\/+$/, '');

  for (const page of pages) {
    const outputPath = outputPathFor(page.path);
    const prefix = prefixFor(outputPath);

    const composed = composePage(
      prefixImagePaths(page.tree, prefix),
      header ? prefixImagePaths(header, prefix) : null,
      footer ? prefixImagePaths(footer, prefix) : null,
    );

    files[outputPath] = renderDocument(composed, {
      title: page.title,
      description: page.description,
      socialImage: page.socialImage ? absolute(page.socialImage, baseUrl) : null,
      canonical: baseUrl ? `${baseUrl}${page.path === '/' ? '/' : page.path}` : null,
      noIndex: page.noIndex,
      favicon: input.favicon ? `${prefix}assets/favicon` : null,
      siteName: input.name,
      stylesheetHref: `${prefix}assets/styles.css`,
      runtimeSrc: anyRuntime ? `${prefix}assets/builder.js` : undefined,
      headExtra: externalLinks,
    });
  }

  if (input.favicon) {
    const match = DATA_URL.exec(input.favicon);
    if (match) {
      const [, , base64, payload] = match;
      files['assets/favicon'] = base64
        ? Uint8Array.from(Buffer.from(payload, 'base64'))
        : decodeURIComponent(payload);
    }
  }

  // A sitemap needs absolute URLs, so it is only meaningful once the site's
  // final origin is known.
  const indexable = pages.filter((page) => !page.noIndex);
  if (baseUrl && indexable.length) {
    files['sitemap.xml'] =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      indexable
        .map((page) => `  <url><loc>${xmlEscape(`${baseUrl}${page.path === '/' ? '/' : page.path}`)}</loc></url>`)
        .join('\n') +
      `\n</urlset>\n`;
  }

  files['robots.txt'] =
    `User-agent: *\n` +
    pages
      .filter((page) => page.noIndex)
      .map((page) => `Disallow: ${page.path}\n`)
      .join('') +
    `Allow: /\n` +
    (baseUrl ? `\nSitemap: ${baseUrl}/sitemap.xml\n` : '');

  files['README.txt'] =
    `${input.name}\n\nStatic export from Website Builder.\n\n` +
    `Upload the contents of this folder to any static host (Netlify, Vercel, S3,\n` +
    `GitHub Pages, or plain nginx/Apache). index.html is the home page.\n\n` +
    `Internal links use root-relative paths such as /about, which resolve on a\n` +
    `web server but not when opening files directly from disk.\n`;

  return files;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** og:image must be an absolute URL; relative paths are ignored by crawlers. */
function absolute(value: string, baseUrl: string): string {
  if (!value || /^(https?:|data:)/i.test(value)) return value;
  if (!baseUrl) return value;
  return `${baseUrl}/${value.replace(/^\/+/, '')}`;
}

/** Used by the single-page "download this page" action. */
export function buildSinglePageHtml(
  page: ExportPage,
  input: Pick<ExportInput, 'importedCss' | 'customCss'>,
): string {
  return renderDocument(page.tree, {
    title: page.title,
    importedCss: input.importedCss,
    customCss: input.customCss,
  });
}

export { buildStylesheet };
