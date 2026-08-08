import Link from 'next/link';
import { redirect } from 'next/navigation';

import { auth, signOut } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Icon from '@/components/Icon';
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

  const liveCount = projects.filter((project) => project.published).length;

  return (
    <div className="ws-grain min-h-dvh">
      <header className="border-b border-edge bg-panel/60">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accentInk">
            <Icon name="grid" size={17} />
          </span>
          <span className="text-[14px] font-semibold tracking-ui">Website Builder</span>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-[12px] text-faint sm:inline">{session.user.email}</span>
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/' });
              }}
            >
              <button type="submit" className="ws-btn h-8 px-2.5 text-[13px]">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-semibold leading-tight tracking-display text-white">
              Your sites
            </h1>
            <p className="mt-1.5 text-[13px] text-muted">
              {projects.length === 0
                ? 'Nothing here yet — start below.'
                : `${projects.length} site${projects.length === 1 ? '' : 's'}${
                    liveCount > 0 ? `, ${liveCount} published` : ''
                  }`}
            </p>
          </div>
        </div>

        <NewProjectPanel />

        <section className="mt-10">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-edge px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-edge bg-panel text-muted">
                <Icon name="section" size={20} />
              </span>
              <p className="text-[14px] font-medium text-neutral-200">No sites yet</p>
              <p className="max-w-xs text-[13px] leading-relaxed text-faint">
                Create a blank site to start from an empty page, or import an HTML file to edit a
                design you already have.
              </p>
            </div>
          ) : (
            <>
              <h2 className="mb-3 text-[12px] font-semibold text-muted">All sites</h2>
              <ul className="flex flex-col gap-2">
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
            </>
          )}
        </section>

        <p className="mt-10 text-[12px] text-faint">
          Published sites are served at <code className="text-muted">/s/&lt;slug&gt;</code>.{' '}
          <Link href="/" className="text-muted underline-offset-2 hover:text-accent hover:underline">
            About this builder
          </Link>
        </p>
      </main>
    </div>
  );
}
