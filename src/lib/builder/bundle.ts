/**
 * Multi-file import: a template folder or .zip becomes a whole site.
 *
 * Importing a single .html file leaves everything it references dangling —
 * `<link href="css/theme.css">` is unreachable, `img/hero.png` 404s — and the
 * user only discovers it after publishing. Given the whole bundle we can
 * resolve those references, inline the stylesheets, turn local images into
 * assets, and report whatever genuinely isn't there.
 *
 * Browser-only, like the importer it builds on: unzipping and parsing happen
 * on the client, and only the resulting trees and data URLs reach the API.
 */

import JSZip from 'jszip';

import { importHtml, type ImportResult } from './importer';
import { flatten } from './tree';
import type { BuilderNode } from './types';

export interface BundleFile {
  /** Path relative to the bundle root, e.g. "css/theme.css". */
  path: string;
  blob: Blob;
}

export interface BundlePage {
  /** Source file, e.g. "about.html". */
  file: string;
  /** Route derived from the file name: index.html -> "/", about.html -> "/about". */
  path: string;
  title: string;
  root: BuilderNode;
}

export interface MissingRef {
  /** The reference exactly as it appeared in the source. */
  ref: string;
  kind: 'image' | 'stylesheet';
  /** Where it was referenced from. */
  from: string;
}

export interface BundleResult {
  pages: BundlePage[];
  css: string;
  externalStylesheets: string[];
  warnings: string[];
  missing: MissingRef[];
  /** How many local files were inlined, for the import summary. */
  resolvedAssets: number;
}

/** Images we can inline. Anything else stays a plain reference. */
const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
};

/** Resolves "../img/a.png" against "pages/about.html" the way a browser would. */
export function resolvePath(from: string, ref: string): string {
  const base = from.includes('/') ? from.slice(0, from.lastIndexOf('/')) : '';
  const segments = [...base.split('/').filter(Boolean), ...ref.split('/')];
  const out: string[] = [];

  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return out.join('/');
}

function isExternal(ref: string): boolean {
  return /^(https?:)?\/\//i.test(ref) || ref.startsWith('data:') || ref.startsWith('#');
}

/** index.html -> "/", about.html -> "/about", docs/setup.html -> "/docs/setup". */
export function routeForFile(file: string): string {
  const withoutExtension = file.replace(/\.html?$/i, '');
  const cleaned = withoutExtension.replace(/(^|\/)index$/i, '');
  const normalised = cleaned
    .split('/')
    .filter(Boolean)
    .map((segment) =>
      segment
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    )
    .join('/');
  return normalised ? `/${normalised}` : '/';
}

async function toDataUrl(blob: Blob, extension: string): Promise<string> {
  const mime = IMAGE_TYPES[extension] ?? blob.type ?? 'application/octet-stream';

  if (mime === 'image/svg+xml') {
    // SVG stays readable — and far smaller — as text than as base64.
    const text = await blob.text();
    return `data:image/svg+xml,${encodeURIComponent(text)}`;
  }

  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // Chunked, because a large image blows the argument limit of String.fromCharCode.
  for (let i = 0; i < buffer.length; i += 8192) {
    binary += String.fromCharCode(...buffer.subarray(i, i + 8192));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/** Every asset reference a tree makes, so they can be resolved in one pass. */
function collectRefs(root: BuilderNode): { get: () => string[]; rewrite: (map: Map<string, string>) => void } {
  const refs = new Set<string>();
  const nodes = flatten(root);

  const read = (value: unknown) => {
    if (typeof value === 'string' && value && !isExternal(value)) refs.add(value);
  };

  for (const node of nodes) {
    if (node.type === 'image') read(node.props.src);
    if (node.type === 'slider') {
      for (const slide of (node.props.slides as { image?: string }[]) ?? []) read(slide.image);
    }
    for (const map of Object.values(node.styles)) {
      for (const value of Object.values(map)) {
        const match = /url\(\s*['"]?([^'")]+)['"]?\s*\)/.exec(value);
        if (match) read(match[1]);
      }
    }
  }

  return {
    get: () => [...refs],
    rewrite: (map) => {
      const swap = (value: unknown) =>
        typeof value === 'string' && map.has(value) ? map.get(value)! : value;

      for (const node of nodes) {
        if (node.type === 'image') node.props.src = swap(node.props.src);
        if (node.type === 'slider' && Array.isArray(node.props.slides)) {
          node.props.slides = (node.props.slides as Record<string, unknown>[]).map((slide) => ({
            ...slide,
            image: swap(slide.image),
          }));
        }
        for (const styles of Object.values(node.styles)) {
          for (const [prop, value] of Object.entries(styles)) {
            styles[prop] = value.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g, (whole, ref: string) =>
              map.has(ref) ? `url('${map.get(ref)}')` : whole,
            );
          }
        }
      }
    },
  };
}

/** Rewrites url() references inside a stylesheet, relative to its own path. */
function rewriteCssUrls(css: string, from: string, lookup: Map<string, string>, missing: MissingRef[]): string {
  return css.replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g, (whole, ref: string) => {
    if (isExternal(ref)) return whole;
    const resolved = lookup.get(resolvePath(from, ref));
    if (resolved) return `url('${resolved}')`;
    missing.push({ ref, kind: 'image', from });
    return whole;
  });
}

export async function unzip(file: Blob): Promise<BundleFile[]> {
  const zip = await JSZip.loadAsync(file);
  const files: BundleFile[] = [];

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  // Archives usually nest everything under a single folder; stripping it keeps
  // paths matching what the HTML actually references.
  const roots = new Set(entries.map((entry) => entry.name.split('/')[0]));
  const strip = roots.size === 1 && entries.every((entry) => entry.name.includes('/'));

  for (const entry of entries) {
    if (entry.name.startsWith('__MACOSX/') || entry.name.includes('/.')) continue;
    const path = strip ? entry.name.split('/').slice(1).join('/') : entry.name;
    if (!path) continue;
    files.push({ path, blob: await entry.async('blob') });
  }

  return files;
}

export async function importBundle(files: BundleFile[]): Promise<BundleResult> {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const missing: MissingRef[] = [];
  const warnings: string[] = [];

  // --- inline every local image once, so repeats share one data URL --------
  const inlined = new Map<string, string>();
  for (const file of files) {
    const extension = file.path.split('.').pop()?.toLowerCase() ?? '';
    if (!IMAGE_TYPES[extension]) continue;
    inlined.set(file.path, await toDataUrl(file.blob, extension));
  }

  // The first page becomes the site's "/", so index.html must lead — sorting
  // alphabetically would make about.html the home page and collide the route.
  const isIndex = (path: string) => /(^|\/)index\.html?$/i.test(path);

  const htmlFiles = files
    .filter((file) => /\.html?$/i.test(file.path))
    .sort((a, b) => {
      const rootIndexA = isIndex(a.path) && !a.path.includes('/');
      const rootIndexB = isIndex(b.path) && !b.path.includes('/');
      if (rootIndexA !== rootIndexB) return rootIndexA ? -1 : 1;

      return (
        a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path)
      );
    });

  if (!htmlFiles.length) {
    return { pages: [], css: '', externalStylesheets: [], warnings: ['No .html files found.'], missing: [], resolvedAssets: 0 };
  }

  const pages: BundlePage[] = [];
  const stylesheets: string[] = [];
  const seenStylesheets = new Set<string>();
  const externalStylesheets: string[] = [];
  let resolvedAssets = 0;

  for (const file of htmlFiles) {
    const result: ImportResult = importHtml(await file.blob.text());

    // Inline <style> blocks, then any local <link> the bundle can satisfy.
    if (result.css.trim()) {
      stylesheets.push(rewriteCssUrls(result.css, file.path, inlined, missing));
    }

    for (const href of result.externalStylesheets) {
      if (isExternal(href)) {
        if (!externalStylesheets.includes(href)) externalStylesheets.push(href);
        continue;
      }
      const resolved = resolvePath(file.path, href);
      if (seenStylesheets.has(resolved)) continue;

      const match = byPath.get(resolved);
      if (!match) {
        missing.push({ ref: href, kind: 'stylesheet', from: file.path });
        continue;
      }
      seenStylesheets.add(resolved);
      stylesheets.push(rewriteCssUrls(await match.blob.text(), resolved, inlined, missing));
    }

    // Resolve the page's own asset references against the bundle.
    const refs = collectRefs(result.root);
    const map = new Map<string, string>();
    for (const ref of refs.get()) {
      const dataUrl = inlined.get(resolvePath(file.path, ref));
      if (dataUrl) {
        map.set(ref, dataUrl);
        resolvedAssets += 1;
      } else {
        missing.push({ ref, kind: 'image', from: file.path });
      }
    }
    refs.rewrite(map);

    pages.push({
      file: file.path,
      path: routeForFile(file.path),
      title: result.title || file.path,
      root: result.root,
    });

    for (const warning of result.warnings) {
      // Per-file warnings would repeat identically across a template's pages.
      if (!warnings.includes(warning)) warnings.push(warning);
    }
  }

  // Two files mapping to the same route would collide on create.
  const seenRoutes = new Set<string>();
  for (const page of pages) {
    let candidate = page.path;
    let attempt = 2;
    while (seenRoutes.has(candidate)) candidate = `${page.path}-${attempt++}`;
    if (candidate !== page.path) {
      warnings.push(`${page.file} and another file share a route; it was imported as ${candidate}.`);
      page.path = candidate;
    }
    seenRoutes.add(candidate);
  }

  return {
    pages,
    css: stylesheets.join('\n\n'),
    externalStylesheets,
    warnings,
    missing: dedupeMissing(missing),
    resolvedAssets,
  };
}

function dedupeMissing(missing: MissingRef[]): MissingRef[] {
  const seen = new Set<string>();
  return missing.filter((entry) => {
    const key = `${entry.kind}:${entry.ref}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
