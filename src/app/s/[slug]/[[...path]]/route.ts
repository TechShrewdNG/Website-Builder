import { prisma } from '@/lib/db';
import { normalisePath } from '@/lib/projects';
import { composePage, renderDocument } from '@/lib/builder/render';
import { readTheme } from '@/lib/builder/theme';
import type { BuilderNode } from '@/lib/builder/types';

/**
 * Serves published sites at /s/<slug>/<page path>.
 *
 * A route handler rather than a page component, because the output is a whole
 * document produced by the shared renderer — the same function the editor
 * canvas and the .zip export use — not a React tree.
 *
 * Pages are served from `publishedTree`, the snapshot taken at publish time,
 * so edits in progress never appear on a live URL.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string; path?: string[] }> }) {
  const { slug, path } = await params;
  const segments = path ?? [];
  const pagePath = normalisePath(`/${segments.join('/')}`);

  const project = await prisma.project.findFirst({
    where: { slug, published: true },
    include: { pages: true },
  });

  if (!project) return notFoundResponse('This site is not published.');

  const origin = new URL(request.url).origin;
  const siteBase = `${origin}/s/${project.slug}`;

  // Crawler files are served from the site root rather than the app's.
  if (segments.length === 1 && segments[0] === 'sitemap.xml') {
    return sitemapResponse(project.pages, siteBase);
  }
  if (segments.length === 1 && segments[0] === 'robots.txt') {
    return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${siteBase}/sitemap.xml\n`, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const page = project.pages.find((candidate) => candidate.path === pagePath);
  if (!page) return notFoundResponse('Page not found.');

  const tree = (page.publishedTree ?? page.tree) as unknown as BuilderNode | null;
  if (!tree) return notFoundResponse('This page has not been published yet.');

  const theme = readTheme(project.theme);
  const externalLinks = (theme.externalStylesheets ?? [])
    .filter((href) => /^https?:\/\//i.test(href))
    .map((href) => `<link rel="stylesheet" href="${href.replace(/"/g, '&quot;')}">`)
    .join('\n');

  // Published sites share this app's origin, so a <script> pasted into an HTML
  // widget would run there with same-origin privileges. The nonce lets only
  // the builder's own runtime execute; anything user-supplied is blocked.
  const nonce = crypto.randomUUID();

  const header = (project.publishedHeaderTree ?? project.headerTree) as unknown as BuilderNode | null;
  const footer = (project.publishedFooterTree ?? project.footerTree) as unknown as BuilderNode | null;

  const html = renderDocument(composePage(tree, header, footer), {
    title: page.title,
    description: page.description,
    socialImage: page.socialImage,
    canonical: `${siteBase}${page.path === '/' ? '' : page.path}`,
    noIndex: page.noIndex,
    favicon: project.faviconData,
    siteName: project.name,
    importedCss: project.importedCss,
    customCss: project.customCss,
    theme,
    headExtra: externalLinks,
  }).replace('<script>', `<script nonce="${nonce}">`);

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `script-src 'nonce-${nonce}'; object-src 'none'; base-uri 'none'`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}

function sitemapResponse(
  pages: { path: string; noIndex: boolean }[],
  siteBase: string,
): Response {
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    pages
      .filter((page) => !page.noIndex)
      .map(
        (page) =>
          `  <url><loc>${`${siteBase}${page.path === '/' ? '' : page.path}`.replace(/&/g, '&amp;')}</loc></url>`,
      )
      .join('\n') +
    `\n</urlset>\n`;

  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}

function notFoundResponse(message: string) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Not found</title>` +
      `<style>body{font:16px system-ui,sans-serif;display:grid;place-items:center;height:100vh;margin:0;color:#444}</style>` +
      `</head><body><p>${message}</p></body></html>`,
    { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
