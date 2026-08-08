import { NextResponse } from 'next/server';

import { HttpError } from './projects';

/** Maps thrown errors onto responses, keeping internals out of the body. */
export function toResponse(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
