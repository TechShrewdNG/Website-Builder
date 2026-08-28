import { NextResponse } from 'next/server';
import { z } from 'zod';

import { currentUserId } from '@/lib/auth';
import { getPrisma } from '@/lib/db';
import { asJson, emptyTree, normalisePath, requireProject } from '@/lib/projects';
import { toResponse, unauthorized } from '@/lib/http';

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  path: z
    .string()
    .trim()
    .regex(/^\/[a-z0-9\-/]*$/, 'Path must start with / and use lowercase letters, numbers and dashes'),
  tree: z.unknown().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  try {
    const { id } = await params;
    const project = await requireProject(id, userId);

    const path = normalisePath(parsed.data.path);
    if (project.pages.some((page) => page.path === path)) {
      return NextResponse.json({ error: `A page already exists at ${path}` }, { status: 409 });
    }

    const page = await getPrisma().page.create({
      data: {
        projectId: project.id,
        title: parsed.data.title,
        path,
        sortOrder: project.pages.length,
        tree: asJson(parsed.data.tree ?? emptyTree()),
      },
    });

    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    return toResponse(error);
  }
}
