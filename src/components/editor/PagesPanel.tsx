'use client';

import { useCallback, useEffect, useState } from 'react';

import Icon from '@/components/Icon';
import type { EditTarget } from './EditorShell';

export interface PageSummary {
  id: string;
  title: string;
  path: string;
}

export interface PageSeo {
  description: string | null;
  socialImage: string | null;
  noIndex: boolean;
}

interface Revision {
  id: string;
  label: string | null;
  createdAt: string;
}

interface Props {
  pages: PageSummary[];
  activeId: string;
  target: EditTarget;
  seo: PageSeo;
  hasHeader: boolean;
  hasFooter: boolean;
  onSelect: (id: string) => void;
  onTargetChange: (target: EditTarget) => void;
  onCreate: (title: string, path: string, templateId: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSeoChange: (patch: Partial<PageSeo>) => void;
  onRestore: (revisionId: string) => Promise<void>;
}

const PAGE_TEMPLATES = [
  { id: 'blank', label: 'Blank' },
  { id: 'landing', label: 'Landing' },
  { id: 'about', label: 'About' },
  { id: 'portfolio', label: 'Portfolio' },
];

export default function PagesPanel({
  pages,
  activeId,
  target,
  seo,
  hasHeader,
  hasFooter,
  onSelect,
  onTargetChange,
  onCreate,
  onDelete,
  onSeoChange,
  onRestore,
}: Props) {
  const [title, setTitle] = useState('');
  const [path, setPath] = useState('');
  const [templateId, setTemplateId] = useState('blank');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<Revision[] | null>(null);
  const [revisionBusy, setRevisionBusy] = useState(false);

  const loadRevisions = useCallback(async () => {
    if (!activeId) return;
    const response = await fetch(`/api/pages/${activeId}/revisions`);
    if (!response.ok) return;
    const payload = await response.json();
    setRevisions(payload.revisions ?? []);
  }, [activeId]);

  useEffect(() => {
    setRevisions(null);
    if (target.kind === 'page') void loadRevisions();
  }, [activeId, target.kind, loadRevisions]);

  async function snapshot() {
    setRevisionBusy(true);
    await fetch(`/api/pages/${activeId}/revisions`, { method: 'POST' });
    await loadRevisions();
    setRevisionBusy(false);
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await onCreate(title.trim(), path.trim() || slugify(title), templateId);
      setTitle('');
      setPath('');
      setTemplateId('blank');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the page');
    } finally {
      setBusy(false);
    }
  }

  const editingPage = target.kind === 'page';

  return (
    <div className="thin-scroll h-full overflow-y-auto p-3">
      <ul className="flex flex-col gap-0.5">
        {pages.map((page) => (
          <li key={page.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onTargetChange({ kind: 'page' });
                onSelect(page.id);
              }}
              className={`flex flex-1 items-center gap-2 truncate rounded-md px-2 py-2 text-left text-[12px] transition-colors duration-150 ${
                editingPage && page.id === activeId
                  ? 'bg-accent/12 text-white'
                  : 'text-muted hover:bg-panelRaised hover:text-neutral-200'
              }`}
            >
              <Icon
                name="pages"
                size={14}
                className={`shrink-0 ${editingPage && page.id === activeId ? 'text-accent' : 'text-faint'}`}
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

      {/* Global sections sit beside pages because that's how they're edited,
          even though they belong to the site rather than any one page. */}
      <div className="mt-4 border-t border-edge pt-3">
        <span className="ws-label">Shown on every page</span>
        {(['header', 'footer'] as const).map((slot) => {
          const active = target.kind === slot;
          const exists = slot === 'header' ? hasHeader : hasFooter;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => onTargetChange({ kind: slot })}
              className={`mb-0.5 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[12px] capitalize transition-colors duration-150 ${
                active ? 'bg-accent/12 text-white' : 'text-muted hover:bg-panelRaised hover:text-neutral-200'
              }`}
            >
              <Icon name="section" size={14} className={`shrink-0 ${active ? 'text-accent' : 'text-faint'}`} />
              Site {slot}
              {!exists && <span className="ml-auto shrink-0 text-[10px] text-faint">empty</span>}
            </button>
          );
        })}
      </div>

      {editingPage && (
        <>
          <Section title="Search & sharing">
            <label className="mb-2 block">
              <span className="ws-label">Description</span>
              <textarea
                className="ws-field min-h-16 text-[12px]"
                maxLength={320}
                value={seo.description ?? ''}
                placeholder="One or two sentences shown in search results and link previews."
                onChange={(event) => onSeoChange({ description: event.target.value })}
              />
              <span className="mt-1 block text-right text-[10px] tabular-nums text-faint">
                {(seo.description ?? '').length}/320
              </span>
            </label>

            <label className="mb-2 block">
              <span className="ws-label">Social image URL</span>
              <input
                className="ws-field text-[12px]"
                value={seo.socialImage ?? ''}
                placeholder="https://…/preview.png"
                onChange={(event) => onSeoChange({ socialImage: event.target.value })}
              />
              <span className="mt-1 block text-[10px] leading-relaxed text-faint">
                Shown when the page is shared. 1200×630 works everywhere.
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-2.5 text-[12px] text-neutral-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[rgb(215_155_60)]"
                checked={seo.noIndex}
                onChange={(event) => onSeoChange({ noIndex: event.target.checked })}
              />
              Hide from search engines
            </label>
          </Section>

          <Section title="History">
            <button
              type="button"
              className="ws-btn mb-2 w-full py-1.5 text-[12px]"
              onClick={snapshot}
              disabled={revisionBusy}
            >
              <Icon name="copy" size={14} />
              {revisionBusy ? 'Saving…' : 'Save a snapshot'}
            </button>

            {revisions === null ? (
              <p className="text-[11px] text-faint">Loading…</p>
            ) : revisions.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-faint">
                No snapshots yet. One is taken automatically each time you publish.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {revisions.map((revision) => (
                  <li
                    key={revision.id}
                    className="flex items-center gap-2 rounded-md bg-panelRaised px-2 py-1.5 text-[11px]"
                  >
                    <span className="min-w-0 flex-1 truncate text-muted">
                      {revision.label ?? new Date(revision.createdAt).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-accent transition-opacity hover:opacity-80"
                      onClick={async () => {
                        if (!confirm('Restore this snapshot? The current version is saved first.')) return;
                        await onRestore(revision.id);
                        await loadRevisions();
                      }}
                    >
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      <Section title="Add a page">
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
        <select
          className="ws-field mb-2"
          value={templateId}
          onChange={(event) => setTemplateId(event.target.value)}
          aria-label="Starting template"
        >
          {PAGE_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              Start from: {template.label}
            </option>
          ))}
        </select>
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
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 border-t border-edge pt-3">
      <h3 className="mb-2 text-[12px] font-semibold text-neutral-200">{title}</h3>
      {children}
    </section>
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
