import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { HttpError } from './projects';

/**
 * Turns a thrown error into a response.
 *
 * Database problems are the ones worth naming. A deployment whose schema was
 * never pushed, or whose DATABASE_URL points somewhere unreachable, otherwise
 * surfaces as an anonymous 500 — the operator sees "something went wrong" on
 * every screen with no hint that the fix is a one-line command. These messages
 * describe the deployment's own state, never the query or the connection
 * string, so there is nothing here an attacker gains from.
 */
export function toResponse(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const database = describeDatabaseError(error);
  if (database) {
    console.error(database.log, error);
    return NextResponse.json({ error: database.message }, { status: database.status });
  }

  console.error(error);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

interface DatabaseFailure {
  status: number;
  message: string;
  log: string;
}

export function describeDatabaseError(error: unknown): DatabaseFailure | null {
  // Thrown before a query is even sent: bad URL, unreachable host, bad
  // credentials, or a database that does not exist.
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      message:
        'Cannot connect to the database. Check that DATABASE_URL is set correctly and that the database is reachable.',
      log: '[db] connection failed — check DATABASE_URL',
    };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      // The connection works but the tables were never created.
      case 'P2021':
      case 'P2022':
        return {
          status: 503,
          message:
            'The database is reachable but its schema is missing. Run `npm run db:push` against this database, then try again.',
          log: `[db] schema missing (${error.code}) — run prisma db push`,
        };
      case 'P1001':
      case 'P1002':
        return {
          status: 503,
          message: 'The database is not responding. Check that DATABASE_URL points at a running database.',
          log: `[db] unreachable (${error.code})`,
        };
      case 'P1000':
        return {
          status: 503,
          message: 'The database rejected the credentials in DATABASE_URL.',
          log: '[db] authentication failed (P1000)',
        };
      case 'P1003':
        return {
          status: 503,
          message: 'The database named in DATABASE_URL does not exist.',
          log: '[db] database does not exist (P1003)',
        };
      // Two requests raced for the same unique value.
      case 'P2002':
        return {
          status: 409,
          message: 'That value is already taken.',
          log: '[db] unique constraint violated (P2002)',
        };
      default:
        return null;
    }
  }

  return null;
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
