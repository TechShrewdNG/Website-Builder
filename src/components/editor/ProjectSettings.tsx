'use client';

import { useState } from 'react';

import type { EditorProject } from './EditorShell';

interface Props {
  project: EditorProject;
  page: { id: string; title: string; path: string };
  onProjectChange: (patch: Partial<EditorProject>) => void;
  onPageChange: (patch: { title?: string; path?: string }) => void;
}

/**
 * Project- and page-level settings. Unlike widget edits these are saved on
 * blur rather than continuously — a half-typed CSS rule shouldn't be persisted
 * or re-applied to the canvas on every keystroke.
 */
export default function ProjectSettings({ project, page, onProjectChange, onPageChange }: Props) {
  const [status, setStatus] = useState<string | null>(null);

  async function saveProject(patch: Partial<EditorProject>) {
    onProjectChange(patch);
    const response = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setStatus(response.ok ? 'Saved' : 'Could not save');
    setTimeout(() => setStatus(null), 2000);
  }

  async function savePage(patch: { title?: string; path?: string }) {
    const response = await fetch(`/api/pages/${page.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(payload.error ?? 'Could not save');
      setTimeout(() => setStatus(null), 3000);
      return;
    }
    onPageChange(patch);
    setStatus('Saved');
    setTimeout(() => setStatus(null), 2000);
  }

  return (
    <div className="thin-scroll h-full overflow-y-auto p-3">
      <section className="mb-5">
        <span className="ws-label">Site name</span>
        <input
          className="ws-field"
          defaultValue={project.name}
          onBlur={(event) => {
            const name = event.target.value.trim();
            if (name && name !== project.name) void saveProject({ name });
          }}
        />
        <p className="mt-1 text-[11px] text-neutral-500">
          Published at <code>/s/{project.slug}</code>
        </p>
      </section>

      <section className="mb-5 border-t border-edge pt-4">
        <span className="ws-label">Current page</span>
        <input
          className="ws-field mb-2"
          defaultValue={page.title}
          key={`${page.id}-title`}
          onBlur={(event) => {
            const title = event.target.value.trim();
            if (title && title !== page.title) void savePage({ title });
          }}
        />
        <input
          className="ws-field"
          defaultValue={page.path}
          key={`${page.id}-path`}
          onBlur={(event) => {
            const path = event.target.value.trim();
            if (path && path !== page.path) void savePage({ path });
          }}
        />
        <p className="mt-1 text-[11px] text-neutral-500">
          Lowercase letters, numbers and dashes, starting with /
        </p>
      </section>

      <section className="mb-5 border-t border-edge pt-4">
        <span className="ws-label">Project CSS</span>
        <textarea
          className="ws-field min-h-40 font-mono text-[11px]"
          defaultValue={project.customCss ?? ''}
          placeholder={'.my-class {\n  color: red;\n}'}
          onBlur={(event) => void saveProject({ customCss: event.target.value })}
        />
        <p className="mt-1 text-[11px] text-neutral-500">
          Applied after generated styles, on every page. Saved when you click away.
        </p>
      </section>

      {project.importedCss && (
        <section className="border-t border-edge pt-4">
          <span className="ws-label">Imported stylesheet</span>
          <textarea
            className="ws-field min-h-32 font-mono text-[11px]"
            defaultValue={project.importedCss}
            onBlur={(event) => void saveProject({ importedCss: event.target.value })}
          />
          <p className="mt-1 text-[11px] text-neutral-500">
            Came from the imported template. Generated styles override it, so edits here stay safe.
          </p>
        </section>
      )}

      {status && <p className="mt-4 text-xs text-neutral-400">{status}</p>}
    </div>
  );
}
