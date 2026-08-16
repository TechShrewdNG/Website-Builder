import JSZip from 'jszip';

import { currentUserId } from '@/lib/auth';
import { requireProject } from '@/lib/projects';
import { toResponse, unauthorized } from '@/lib/http';
import { buildExport } from '@/lib/builder/export';
import { readTheme } from '@/lib/builder/theme';
import type { BuilderNode } from '@/lib/builder/types';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const project = await requireProject(id, userId);

    const theme = readTheme(project.theme);

    const files = buildExport({
      name: project.name,
      importedCss: project.importedCss,
      customCss: project.customCss,
      externalStylesheets: theme.externalStylesheets,
      theme,
      header: project.headerTree as unknown as BuilderNode | null,
      footer: project.footerTree as unknown as BuilderNode | null,
      favicon: project.faviconData,
      baseUrl: project.siteUrl,
      pages: project.pages.map((page) => ({
        title: page.title,
        path: page.path,
        tree: page.tree as unknown as BuilderNode,
        description: page.description,
        socialImage: page.socialImage,
        noIndex: page.noIndex,
      })),
    });

    const zip = new JSZip();
    for (const [path, content] of Object.entries(files)) zip.file(path, content);

    const buffer = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${project.slug}.zip"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (error) {
    return toResponse(error);
  }
}
