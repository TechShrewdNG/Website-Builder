import { NextResponse } from 'next/server';
import { z } from 'zod';

import { currentUserId } from '@/lib/auth';
import { Prisma } from '@prisma/client';

import { getPrisma } from '@/lib/db';
import { requireProject } from '@/lib/projects';
import { toResponse, unauthorized } from '@/lib/http';

const schema = z.object({ published: z.boolean() });

type Params = { params: Promise<{ id: string }> };

/**
 * Publishing snapshots every page's tree into `publishedTree`. The live site
 * serves the snapshot, so continuing to edit in the builder never leaks
 * half-finished work onto a published URL.
 */
export async function POST(request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  try {
    const { id } = await params;
    const project = await requireProject(id, userId);
    const prisma = getPrisma();

    if (!parsed.data.published) {
      await prisma.project.update({ where: { id }, data: { published: false } });
      return NextResponse.json({ published: false });
    }

    await prisma.$transaction([
      ...project.pages.map((page) =>
        prisma.page.update({ where: { id: page.id }, data: { publishedTree: page.tree ?? undefined } }),
      ),
      prisma.project.update({
        where: { id },
        data: {
          published: true,
          publishedAt: new Date(),
          // Globals are snapshotted alongside pages, or a live site could
          // show a published page inside an unpublished header.
          publishedHeaderTree: project.headerTree ?? Prisma.DbNull,
          publishedFooterTree: project.footerTree ?? Prisma.DbNull,
        },
      }),
    ]);

    return NextResponse.json({ published: true, url: `/s/${project.slug}` });
  } catch (error) {
    return toResponse(error);
  }
}
