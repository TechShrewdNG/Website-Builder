import { NextResponse } from 'next/server';

import { currentUserId } from '@/lib/auth';
import { getPrisma } from '@/lib/db';
import { asJson, requirePage } from '@/lib/projects';
import { toResponse, unauthorized } from '@/lib/http';

type Params = { params: Promise<{ pageId: string; revisionId: string }> };

/**
 * Restores a snapshot.
 *
 * The current tree is snapshotted first, so restoring is itself undoable —
 * otherwise recovering an old version would quietly destroy the newer one.
 */
export async function POST(_request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  try {
    const { pageId, revisionId } = await params;
    const page = await requirePage(pageId, userId);
    const prisma = getPrisma();

    const revision = await prisma.pageRevision.findFirst({ where: { id: revisionId, pageId } });
    if (!revision) return NextResponse.json({ error: 'Revision not found' }, { status: 404 });

    const [, updated] = await prisma.$transaction([
      prisma.pageRevision.create({
        data: { pageId, label: 'Before restore', tree: asJson(page.tree) },
      }),
      prisma.page.update({ where: { id: pageId }, data: { tree: asJson(revision.tree) } }),
    ]);

    return NextResponse.json({ page: { id: updated.id, tree: updated.tree } });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  try {
    const { pageId, revisionId } = await params;
    await requirePage(pageId, userId);
    await getPrisma().pageRevision.deleteMany({ where: { id: revisionId, pageId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
