import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { describeDatabaseError } from '@/lib/http';

/**
 * Deployment self-check.
 *
 * The two things that break a fresh deploy — an unset/wrong DATABASE_URL and a
 * schema that was never pushed — both look identical from the UI: every action
 * fails with a generic error. This reports which one it is without needing
 * access to the runtime logs.
 *
 * It reveals only whether the app's own config is complete. No connection
 * details, credentials or data are exposed.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, string> = {
    authSecret: process.env.AUTH_SECRET ? 'set' : 'MISSING — sign-in will fail',
    databaseUrl: process.env.DATABASE_URL ? 'set' : 'MISSING',
  };

  let ok = Boolean(process.env.AUTH_SECRET && process.env.DATABASE_URL);

  try {
    // Touches a real table, so it fails when the schema is missing rather than
    // passing on a bare connection the way SELECT 1 would.
    await prisma.user.count();
    checks.database = 'connected, schema present';
  } catch (error) {
    ok = false;
    checks.database = describeDatabaseError(error)?.message ?? 'Unknown database error';
  }

  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
