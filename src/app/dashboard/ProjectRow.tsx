'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <Link href={`/editor/${project.id}`} className="font-medium hover:text-accent">
          {project.name}
        </Link>
        <p className="text-xs text-neutral-500">
          {project.pageCount} page{project.pageCount === 1 ? '' : 's'} · edited{' '}
          {new Date(project.updatedAt).toLocaleDateString()}
          {project.published && (
            <>
              {' · '}
              <Link href={`/s/${project.slug}`} className="text-emerald-400 hover:underline">
                live at /s/{project.slug}
              </Link>
            </>
          )}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <a className="ws-btn" href={`/api/projects/${project.id}/export`}>
          Export
        </a>
        <Link className="ws-btn" href={`/editor/${project.id}`}>
          Edit
        </Link>
        <button type="button" className="ws-btn" onClick={remove} disabled={busy}>
          {busy ? '…' : 'Delete'}
        </button>
      </div>
    </li>
  );
}
