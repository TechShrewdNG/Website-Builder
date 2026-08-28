import { NextResponse } from 'next/server';

import { currentUserId } from '@/lib/auth';
import { getPrisma } from '@/lib/db';
import { toResponse, unauthorized } from '@/lib/http';

type Params = { params: Promise<{ assetId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  try {
    const { assetId } = await params;
    const prisma = getPrisma();

    // Scoped through the owning project, so an id alone grants nothing.
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, project: { ownerId: userId } },
      select: { id: true },
    });
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    await prisma.asset.delete({ where: { id: assetId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
