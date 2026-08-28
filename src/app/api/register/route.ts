import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { getPrisma } from '@/lib/db';
import { toResponse } from '@/lib/http';

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();

  // Without this, any database problem — an unpushed schema, an unreachable
  // host — escapes as a bare 500 with an empty body, and the sign-up form can
  // only say "could not create the account".
  try {
    const prisma = getPrisma();
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 });
    }

    await prisma.user.create({
      data: {
        email,
        name: parsed.data.name ?? null,
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return toResponse(error);
  }
}
