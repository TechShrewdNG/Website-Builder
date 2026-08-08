import { NextResponse } from 'next/server';
import { z } from 'zod';

import { currentUserId } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { asJson, normalisePath, requirePage } from '@/lib/projects';
import { toResponse, unauthorized } from '@/lib/http';

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  path: z
    .string()
    .trim()
    .regex(/^\/[a-z0-9\-/]*$/)
    .optional(),
  tree: z.unknown().optional(),
});

type Params = { params: Promise<{ pageId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  try {
    const { pageId } = await params;
    return NextResponse.json({ page: await requirePage(pageId, userId) });
  } catch (error) {
    return toResponse(error);
  }
}

/** The editor's autosave target. */
export async function PATCH(request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  try {
    const { pageId } = await params;
    const page = await requirePage(pageId, userId);

    const path = parsed.data.path ? normalisePath(parsed.data.path) : undefined;
    if (path && path !== page.path) {
      const clash = await prisma.page.findFirst({
        where: { projectId: page.projectId, path },
        select: { id: true },
      });
      if (clash) return NextResponse.json({ error: `A page already exists at ${path}` }, { status: 409 });
    }

    const updated = await prisma.page.update({
      where: { id: pageId },
      data: {
        title: parsed.data.title,
        path,
        tree: parsed.data.tree === undefined ? undefined : asJson(parsed.data.tree),
      },
      select: { id: true, updatedAt: true, title: true, path: true },
    });

    // Surfaces the project as recently worked on in the dashboard.
    await prisma.project.update({ where: { id: page.projectId }, data: { updatedAt: new Date() } });

    return NextResponse.json({ page: updated });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  try {
    const { pageId } = await params;
    const page = await requirePage(pageId, userId);

    const count = await prisma.page.count({ where: { projectId: page.projectId } });
    if (count <= 1) {
      return NextResponse.json({ error: 'A project needs at least one page' }, { status: 400 });
    }

    await prisma.page.delete({ where: { id: pageId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
