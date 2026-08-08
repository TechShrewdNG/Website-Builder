import Link from 'next/link';

import { auth } from '@/lib/auth';

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Website Builder</h1>
        <p className="mt-4 text-lg text-neutral-400">
          Import an existing HTML template or start from a blank page, edit it visually with
          drag-and-drop, then publish it or download clean static files.
        </p>
      </div>

      <div className="flex gap-3">
        {session?.user ? (
          <Link href="/dashboard" className="ws-btn-primary">
            Open dashboard
          </Link>
        ) : (
          <>
            <Link href="/register" className="ws-btn-primary">
              Create an account
            </Link>
            <Link href="/login" className="ws-btn">
              Sign in
            </Link>
          </>
        )}
      </div>

      <ul className="grid gap-3 text-sm text-neutral-400 sm:grid-cols-2">
        <li className="rounded border border-edge p-4">
          <strong className="block text-neutral-200">Import & edit</strong>
          Bring in a static template; its stylesheet and classes are preserved so it looks the same
          before you change anything.
        </li>
        <li className="rounded border border-edge p-4">
          <strong className="block text-neutral-200">Build from scratch</strong>
          Sections, columns, headings, images, buttons, sliders, tabs, accordions and counters.
        </li>
        <li className="rounded border border-edge p-4">
          <strong className="block text-neutral-200">Responsive controls</strong>
          Separate styles per breakpoint, with desktop values inherited unless you override them.
        </li>
        <li className="rounded border border-edge p-4">
          <strong className="block text-neutral-200">Real output</strong>
          Publish to a URL or download a .zip of plain HTML, CSS and images with no lock-in.
        </li>
      </ul>
    </main>
  );
}
