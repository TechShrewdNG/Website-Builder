import { NextResponse } from 'next/server';
import { z } from 'zod';

import { currentUserId } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { asJson, requirePage } from '@/lib/projects';
import { toResponse, unauthorized } from '@/lib/http';

/**
 * Page revisions.
 *
 * Snapshots are explicit — taken on publish or on request — rather than on
 * every autosave, so the list stays a record of meaningful states instead of
 * thousands of keystroke-level rows nobody can navigate.
 */
const REVISION_LIMIT = 30;

const createSchema = z.object({ label: z.string().trim().max(80).optional() });

type Params = { params: Promise<{ pageId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  try {
    const { pageId } = await params;
    await requirePage(pageId, userId);

    const revisions = await prisma.pageRevision.findMany({
      where: { pageId },
      orderBy: { createdAt: 'desc' },
      // The tree itself is fetched only on restore; listing it would send
      // megabytes to render a sidebar.
      select: { id: true, label: true, createdAt: true },
      take: REVISION_LIMIT,
    });

    return NextResponse.json({ revisions });
  } catch (error) {
    return toResponse(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  try {
    const { pageId } = await params;
    const page = await requirePage(pageId, userId);

    const revision = await prisma.pageRevision.create({
      data: { pageId, label: parsed.data.label || null, tree: asJson(page.tree) },
      select: { id: true, label: true, createdAt: true },
    });

    // Keep the history bounded; the oldest snapshots are the least useful.
    const stale = await prisma.pageRevision.findMany({
      where: { pageId },
      orderBy: { createdAt: 'desc' },
      skip: REVISION_LIMIT,
      select: { id: true },
    });
    if (stale.length) {
      await prisma.pageRevision.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
    }

    return NextResponse.json({ revision }, { status: 201 });
  } catch (error) {
    return toResponse(error);
  }
}
