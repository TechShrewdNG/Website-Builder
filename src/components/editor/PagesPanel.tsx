'use client';

import { useState } from 'react';

import Icon from '@/components/Icon';

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
              className={`flex flex-1 items-center gap-2 truncate rounded-md px-2 py-2 text-left text-[12px] transition-colors duration-150 ${
                page.id === activeId
                  ? 'bg-accent/12 text-white'
                  : 'text-muted hover:bg-panelRaised hover:text-neutral-200'
              }`}
            >
              <Icon
                name="pages"
                size={14}
                className={`shrink-0 ${page.id === activeId ? 'text-accent' : 'text-faint'}`}
              />
              <span className="truncate">{page.title}</span>
              <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">{page.path}</span>
            </button>
            {pages.length > 1 && (
              <button
                type="button"
                title={`Delete ${page.title}`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                onClick={() => {
                  if (confirm(`Delete the page "${page.title}"?`)) void onDelete(page.id);
                }}
              >
                <Icon name="trash" size={13} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-5 border-t border-edge pt-4">
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
        <button
          type="button"
          className="ws-btn w-full py-1.5 text-[12px]"
          disabled={busy || !title.trim()}
          onClick={create}
        >
          <Icon name="plus" size={14} />
          {busy ? 'Adding…' : 'Add page'}
        </button>
        {error && <p className="mt-2 text-[11px] leading-relaxed text-danger">{error}</p>}
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
