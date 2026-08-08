import { notFound, redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import EditorShell from '@/components/editor/EditorShell';
import type { BuilderNode } from '@/lib/builder/types';

export const dynamic = 'force-dynamic';

export default async function EditorPage({ params }: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId: session.user.id },
    include: { pages: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!project) notFound();

  const theme = (project.theme ?? {}) as { externalStylesheets?: string[] };

  return (
    <EditorShell
      project={{
        id: project.id,
        name: project.name,
        slug: project.slug,
        published: project.published,
        importedCss: project.importedCss,
        customCss: project.customCss,
        externalStylesheets: theme.externalStylesheets ?? [],
      }}
      pages={project.pages.map((page) => ({
        id: page.id,
        title: page.title,
        path: page.path,
        tree: page.tree as unknown as BuilderNode,
      }))}
    />
  );
}
