import { NextResponse } from 'next/server';
import { z } from 'zod';

import { currentUserId } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireProject } from '@/lib/projects';
import { toResponse, unauthorized } from '@/lib/http';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  customCss: z.string().max(500_000).optional(),
  importedCss: z.string().max(2_000_000).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    return NextResponse.json({ project: await requireProject(id, userId) });
  } catch (error) {
    return toResponse(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  try {
    const { id } = await params;
    await requireProject(id, userId);
    const project = await prisma.project.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ project });
  } catch (error) {
    return toResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    await requireProject(id, userId);
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
