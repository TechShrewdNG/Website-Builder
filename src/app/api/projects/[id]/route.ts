import { NextResponse } from 'next/server';
import { z } from 'zod';

import { currentUserId } from '@/lib/auth';
import { getPrisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

import { asJson, requireProject } from '@/lib/projects';
import { toResponse, unauthorized } from '@/lib/http';

// These, plus theme and the rest of the row's smaller columns, all have to
// fit together under D1's 2,000,000-byte row cap — so each cap here leaves
// headroom for the others rather than each independently maxing out at 2MB.
const patchSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  customCss: z.string().max(400_000).optional(),
  importedCss: z.string().max(1_400_000).optional(),
  faviconData: z.string().max(100_000).nullable().optional(),
  siteUrl: z.string().max(300).optional(),
  // `null` clears a global section; omitting it leaves the slot untouched.
  headerTree: z.unknown().optional(),
  footerTree: z.unknown().optional(),
  theme: z
    .object({
      externalStylesheets: z.array(z.string()).optional(),
      tokens: z.record(z.string()).optional(),
      ruleOverrides: z.record(z.record(z.string())).optional(),
    })
    .optional(),
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

    const { headerTree, footerTree, siteUrl, theme, ...rest } = parsed.data;
    const project = await getPrisma().project.update({
      where: { id },
      data: {
        ...rest,
        // Trailing slashes would double up when canonical URLs are built.
        ...(siteUrl === undefined ? {} : { siteUrl: siteUrl.trim().replace(/\/+$/, '') || null }),
        ...(theme === undefined ? {} : { theme: asJson(theme) }),
        ...(headerTree === undefined ? {} : { headerTree: headerTree === null ? Prisma.DbNull : asJson(headerTree) }),
        ...(footerTree === undefined ? {} : { footerTree: footerTree === null ? Prisma.DbNull : asJson(footerTree) }),
      },
    });
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
    await getPrisma().project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toResponse(error);
  }
}
