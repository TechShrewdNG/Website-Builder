import { NextResponse } from 'next/server';

import { currentUserId } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireProject } from '@/lib/projects';
import { toResponse, unauthorized } from '@/lib/http';

/**
 * Image uploads.
 *
 * Images are stored as data URLs on the Asset row rather than on a blob
 * service, which keeps the MVP to a single dependency (Postgres). The 2 MB cap
 * is what keeps that defensible; the export step turns these back into real
 * files. Swapping in S3/R2 later means changing only this route and the `data`
 * column's meaning.
 */
const MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml']);

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  try {
    const form = await request.formData();
    const file = form.get('file');
    const projectId = String(form.get('projectId') ?? '');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: `Unsupported image type: ${file.type || 'unknown'}` }, { status: 415 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Images must be 2 MB or smaller' }, { status: 413 });
    }

    const project = await requireProject(projectId, userId);

    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${bytes.toString('base64')}`;

    const asset = await prisma.asset.create({
      data: {
        projectId: project.id,
        filename: file.name.slice(0, 200),
        mimeType: file.type,
        size: file.size,
        data: dataUrl,
      },
      select: { id: true, filename: true, data: true, createdAt: true },
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return toResponse(error);
  }
}

export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const projectId = new URL(request.url).searchParams.get('projectId') ?? '';

  try {
    await requireProject(projectId, userId);
    const assets = await prisma.asset.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, filename: true, data: true, createdAt: true },
      take: 100,
    });
    return NextResponse.json({ assets });
  } catch (error) {
    return toResponse(error);
  }
}
