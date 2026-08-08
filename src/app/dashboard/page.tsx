import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth, signOut } from '@/lib/auth';
import { prisma } from '@/lib/db';
import NewProjectPanel from './NewProjectPanel';
import ProjectRow from './ProjectRow';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const projects = await prisma.project.findMany({
    where: { ownerId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      published: true,
      updatedAt: true,
      pages: { select: { id: true }, take: 100 },
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Your sites</h1>
          <p className="text-sm text-neutral-500">{session.user.email}</p>
        </div>
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/' });
          }}
        >
          <button type="submit" className="ws-btn">
            Sign out
          </button>
        </form>
      </header>

      <NewProjectPanel />

      <section className="mt-10">
        {projects.length === 0 ? (
          <p className="rounded border border-dashed border-edge px-4 py-10 text-center text-sm text-neutral-500">
            No sites yet. Create a blank one or import an HTML file above.
          </p>
        ) : (
          <ul className="divide-y divide-edge rounded border border-edge">
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={{
                  id: project.id,
                  name: project.name,
                  slug: project.slug,
                  published: project.published,
                  pageCount: project.pages.length,
                  updatedAt: project.updatedAt.toISOString(),
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-xs text-neutral-600">
        Published sites are served at <code>/s/&lt;slug&gt;</code>.{' '}
        <Link href="/" className="hover:underline">
          About this builder
        </Link>
      </p>
    </main>
  );
}
