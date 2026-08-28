import { cache } from 'react';
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * Built fresh per request, not cached at module scope.
 *
 * A Cloudflare Worker isolate is reused across many requests, so a
 * module-level singleton (the natural instinct coming from a Postgres pool,
 * where reuse is the whole point) ends up sharing one PrismaClient — and by
 * extension one D1 driver adapter instance — across requests that have
 * nothing to do with each other. In practice that reuse eventually hangs the
 * Worker: a request never resolves, gets killed by the runtime, and every
 * later request on that same warm isolate hangs too until it's recycled.
 * `cache()` scopes this to the current request only (Next.js's per-request
 * store), which still dedupes multiple `getPrisma()` calls made while
 * handling one request, without reusing anything across requests.
 */
export const getPrisma = cache((): PrismaClient => {
  const { env } = getCloudflareContext();
  const adapter = new PrismaD1(env.DB);
  return new PrismaClient({ adapter });
});
