import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import { getCloudflareContext } from '@opennextjs/cloudflare';

/**
 * D1, unlike a Postgres connection pool, is only reachable through the
 * Worker's per-request `env` bindings — there's nothing to connect to at
 * module load time, so the client can't be a plain top-level singleton the
 * way it was for Postgres. It's built lazily on first use inside a request
 * and cached for the life of the Worker isolate; the binding itself doesn't
 * change between requests, so one client is safe to reuse.
 */
let cached: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (cached) return cached;

  const { env } = getCloudflareContext();
  const adapter = new PrismaD1(env.DB);
  cached = new PrismaClient({ adapter });
  return cached;
}
