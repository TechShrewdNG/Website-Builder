import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

import { getPrisma } from '@/lib/db';
import { describeDatabaseError } from '@/lib/http';

/**
 * Deployment self-check.
 *
 * The two things that break a fresh deploy — a missing D1 binding and a
 * schema that was never applied to it — both look identical from the UI:
 * every action fails with a generic error. This reports which one it is
 * without needing access to the runtime logs.
 *
 * It reveals only whether the app's own config is complete. No connection
 * details, credentials or data are exposed.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const hasDbBinding = Boolean(getCloudflareContext().env.DB);

  const checks: Record<string, string> = {
    authSecret: process.env.AUTH_SECRET ? 'set' : 'MISSING — sign-in will fail',
    dbBinding: hasDbBinding ? 'set' : 'MISSING — check wrangler.jsonc\'s d1_databases entry',
  };

  let ok = Boolean(process.env.AUTH_SECRET) && hasDbBinding;

  try {
    // Touches a real table, so it fails when the schema is missing rather than
    // passing on a bare connection the way SELECT 1 would.
    await getPrisma().user.count();
    checks.database = 'connected, schema present';
  } catch (error) {
    ok = false;
    checks.database = describeDatabaseError(error)?.message ?? 'Unknown database error';
  }

  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
