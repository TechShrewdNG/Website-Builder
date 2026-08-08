'use client';

import { useState } from 'react';

export interface PageSummary {
  id: string;
  title: string;
  path: string;
}

interface Props {
  pages: PageSummary[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: (title: string, path: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function PagesPanel({ pages, activeId, onSelect, onCreate, onDelete }: Props) {
  const [title, setTitle] = useState('');
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await onCreate(title.trim(), path.trim() || slugify(title));
      setTitle('');
      setPath('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the page');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="thin-scroll h-full overflow-y-auto p-3">
      <ul className="flex flex-col gap-1">
        {pages.map((page) => (
          <li key={page.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSelect(page.id)}
              className={`flex-1 truncate rounded px-2 py-1.5 text-left text-xs ${
                page.id === activeId ? 'bg-accent/25 text-white' : 'text-neutral-400 hover:bg-panelAlt hover:text-white'
              }`}
            >
              {page.title}
              <span className="ml-1 text-neutral-600">{page.path}</span>
            </button>
            {pages.length > 1 && (
              <button
                type="button"
                title={`Delete ${page.title}`}
                className="px-1 text-xs text-neutral-600 hover:text-red-400"
                onClick={() => {
                  if (confirm(`Delete the page "${page.title}"?`)) void onDelete(page.id);
                }}
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-edge pt-3">
        <span className="ws-label">Add a page</span>
        <input
          className="ws-field mb-2"
          placeholder="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <input
          className="ws-field mb-2"
          placeholder={title ? slugify(title) : '/about'}
          value={path}
          onChange={(event) => setPath(event.target.value)}
        />
        <button type="button" className="ws-btn w-full text-xs" disabled={busy || !title.trim()} onClick={create}>
          {busy ? 'Adding…' : 'Add page'}
        </button>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `/${slug}`;
}
