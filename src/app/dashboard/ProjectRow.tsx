'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import Icon from '@/components/Icon';

interface Props {
  project: {
    id: string;
    name: string;
    slug: string;
    published: boolean;
    pageCount: number;
    updatedAt: string;
  };
}

export default function ProjectRow({ project }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm(`Delete "${project.name}" and all of its pages? This cannot be undone.`)) return;
    setBusy(true);
    const response = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
    setBusy(false);
    if (response.ok) router.refresh();
  }

  return (
    <li
      className="group relative flex flex-col gap-4 rounded-xl border border-edge bg-panel p-4
        transition-[border-color,background-color,transform] duration-200
        hover:-translate-y-0.5 hover:border-edgeStrong hover:bg-panelRaised sm:flex-row sm:items-center"
    >
      {/* Stand-in for the page, until real thumbnails exist. */}
      <Link
        href={`/editor/${project.id}`}
        aria-hidden="true"
        tabIndex={-1}
        className="hidden h-14 w-20 shrink-0 flex-col gap-1 overflow-hidden rounded-lg border border-edge bg-[#0d0d10] p-2 sm:flex"
      >
        <span className="h-1.5 w-3/4 rounded-full bg-edgeStrong" />
        <span className="h-1 w-full rounded-full bg-edge" />
        <span className="h-1 w-5/6 rounded-full bg-edge" />
        <span className="mt-auto h-2 w-8 rounded-sm bg-accent/40" />
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          href={`/editor/${project.id}`}
          // Stretched link: the whole card is the click target, while the
          // buttons below stay individually clickable via their own z-index.
          className="text-[15px] font-semibold text-white after:absolute after:inset-0 after:content-[''] hover:text-accent"
        >
          {project.name}
        </Link>

        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-faint">
          <span className="tabular-nums">
            {project.pageCount} page{project.pageCount === 1 ? '' : 's'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            edited{' '}
            {new Date(project.updatedAt).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>

          {project.published ? (
            <Link
              href={`/s/${project.slug}`}
              target="_blank"
              className="relative z-10 flex items-center gap-1.5 rounded-full bg-positive/10 px-2 py-0.5 font-medium text-positive transition-colors duration-150 hover:bg-positive/20"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden="true" />
              Live
            </Link>
          ) : (
            <span className="rounded-full bg-panelRaised px-2 py-0.5 text-faint">Draft</span>
          )}
        </p>
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-1">
        <a
          className="ws-btn h-8 px-2.5 text-[13px]"
          href={`/api/projects/${project.id}/export`}
          title={`Download ${project.name} as a .zip`}
        >
          <Icon name="download" size={15} />
          Export
        </a>
        <Link className="ws-btn h-8 px-2.5 text-[13px]" href={`/editor/${project.id}`}>
          <Icon name="pencil" size={15} />
          Edit
        </Link>
        <button
          type="button"
          className="ws-btn-danger h-8 w-8 px-0"
          onClick={remove}
          disabled={busy}
          title={`Delete ${project.name}`}
          aria-label={`Delete ${project.name}`}
        >
          <Icon name="trash" size={15} />
        </button>
      </div>
    </li>
  );
}
