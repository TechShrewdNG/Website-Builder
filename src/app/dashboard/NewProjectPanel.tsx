'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { importHtml, type ImportResult } from '@/lib/builder/importer';

/**
 * Project creation, including import.
 *
 * Import parses the HTML here in the browser with DOMParser, so the server
 * never has to host a parser and the user sees warnings before committing.
 */
export default function NewProjectPanel() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ result: ImportResult; filename: string } | null>(null);

  async function create(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not create the project');

      router.push(`/editor/${payload.project.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong');
      setBusy(false);
    }
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    try {
      const result = importHtml(await file.text());
      setPending({ result, filename: file.name });
      if (!name) setName(result.title || file.name.replace(/\.html?$/i, ''));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read that file');
    } finally {
      // Allows re-selecting the same file after a failed attempt.
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  return (
    <section className="mt-8 rounded border border-edge bg-panel p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">New site</h2>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="ws-label" htmlFor="project-name">
            Site name
          </label>
          <input
            id="project-name"
            className="ws-field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Acme marketing site"
          />
        </div>

        <button
          type="button"
          className="ws-btn-primary"
          disabled={busy || !name.trim()}
          onClick={() =>
            create(
              pending
                ? {
                    name: name.trim(),
                    imported: {
                      tree: pending.result.root,
                      title: pending.result.title,
                      css: pending.result.css,
                      externalStylesheets: pending.result.externalStylesheets,
                    },
                  }
                : { name: name.trim() },
            )
          }
        >
          {busy ? 'Creating…' : pending ? 'Create from import' : 'Create blank site'}
        </button>

        <button type="button" className="ws-btn" disabled={busy} onClick={() => fileInput.current?.click()}>
          Import HTML…
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".html,.htm,text/html"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      {pending && (
        <div className="mt-4 rounded border border-edge bg-panelAlt p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span>
              Parsed <strong>{pending.filename}</strong> — {countNodes(pending.result)} elements
              {pending.result.css ? ', stylesheet preserved' : ''}
            </span>
            <button type="button" className="text-xs text-neutral-400 hover:text-white" onClick={() => setPending(null)}>
              Discard
            </button>
          </div>

          {pending.result.warnings.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-300/90">
              {pending.result.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}

function countNodes(result: ImportResult): number {
  let total = 0;
  const walk = (node: { children: unknown[] }) => {
    total += 1;
    for (const child of node.children) walk(child as { children: unknown[] });
  };
  walk(result.root);
  return total;
}
