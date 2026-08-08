import { NextResponse } from 'next/server';
import { z } from 'zod';

import { currentUserId } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { asJson, emptyTree, starterTree, uniqueSlug } from '@/lib/projects';
import { getTemplate } from '@/lib/builder/templates';

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** Set when the project is being seeded from an imported HTML file. */
  imported: z
    .object({
      tree: z.unknown(),
      title: z.string().optional(),
      css: z.string().optional(),
      externalStylesheets: z.array(z.string()).optional(),
    })
    .optional(),
  starter: z.boolean().optional(),
  templateId: z.string().max(40).optional(),
});

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      published: true,
      publishedAt: true,
      updatedAt: true,
      _count: { select: { pages: true } },
    },
  });

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const { name, imported, starter, templateId } = parsed.data;

  // An import always wins: the user supplied real content, so a template
  // would only overwrite it.
  const template = imported ? undefined : templateId ? getTemplate(templateId) : undefined;
  const built = template?.build();

  const tree = imported?.tree ?? built?.page ?? (starter === false ? emptyTree() : starterTree());

  const project = await prisma.project.create({
    data: {
      name,
      slug: await uniqueSlug(name),
      ownerId: userId,
      importedCss: imported?.css ?? null,
      headerTree: built?.header ? asJson(built.header) : undefined,
      footerTree: built?.footer ? asJson(built.footer) : undefined,
      theme: imported?.externalStylesheets?.length
        ? { externalStylesheets: imported.externalStylesheets }
        : undefined,
      pages: {
        create: {
          title: imported?.title || 'Home',
          path: '/',
          sortOrder: 0,
          tree: asJson(tree),
        },
      },
    },
    include: { pages: true },
  });

  return NextResponse.json({ project }, { status: 201 });
}
