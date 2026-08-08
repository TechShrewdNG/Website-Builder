/**
 * Applies pending migrations during the build.
 *
 * Without this, a deployment builds green and then fails on its first query
 * because nobody ran a migration by hand — the schema has to be applied from
 * somewhere, and the build is the only step guaranteed to run on every deploy.
 * `migrate deploy` is idempotent, so repeat deploys are a no-op.
 *
 * Connection poolers in transaction mode can't hold the session-level advisory
 * lock migrations take out. If DIRECT_URL is set, it's used for this step only;
 * the app itself keeps using the pooled DATABASE_URL at runtime.
 */

import { spawnSync } from 'node:child_process';

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (process.env.SKIP_DB_MIGRATE === '1') {
  console.log('[migrate] SKIP_DB_MIGRATE=1 — skipping');
  process.exit(0);
}

if (!url) {
  // Building without a database is legitimate (CI type-checking, a local
  // build before provisioning), so this warns rather than fails. The running
  // app reports the missing schema clearly via /api/health.
  console.warn('[migrate] no DATABASE_URL — skipping migrations');
  process.exit(0);
}

console.log(
  `[migrate] applying migrations via ${process.env.DIRECT_URL ? 'DIRECT_URL' : 'DATABASE_URL'}`,
);

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  console.error(
    '\n[migrate] Migrations failed. If your DATABASE_URL is a transaction-mode\n' +
      '[migrate] pooler, set DIRECT_URL to the direct (non-pooled) connection\n' +
      '[migrate] string and redeploy. Set SKIP_DB_MIGRATE=1 to build anyway.\n',
  );
  process.exit(result.status ?? 1);
}
