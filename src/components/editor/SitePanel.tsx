'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import Icon from '@/components/Icon';
import { extractTokens } from '@/lib/builder/css';
import type { EditorProject } from './EditorShell';

interface Asset {
  id: string;
  filename: string;
  data: string;
  createdAt: string;
}

interface Props {
  project: EditorProject;
  page: { id: string; title: string; path: string };
  onProjectChange: (patch: Partial<EditorProject>) => void;
  onPageChange: (patch: { title?: string; path?: string }) => void;
}

/**
 * Site-level settings and the media library.
 *
 * Text fields save on blur rather than per keystroke — a half-typed CSS rule
 * or site URL shouldn't be persisted, nor re-applied to the canvas mid-word.
 */
export default function SitePanel({ project, page, onProjectChange, onPageChange }: Props) {
  const [status, setStatus] = useState<string | null>(null);

  const flash = useCallback((message: string, ms = 2000) => {
    setStatus(message);
    setTimeout(() => setStatus(null), ms);
  }, []);

  const saveProject = useCallback(
    async (patch: Partial<EditorProject>) => {
      onProjectChange(patch);
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      flash(response.ok ? 'Saved' : 'Could not save');
    },
    [project.id, onProjectChange, flash],
  );

  async function savePage(patch: { title?: string; path?: string }) {
    const response = await fetch(`/api/pages/${page.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      flash(payload.error ?? 'Could not save', 3000);
      return;
    }
    onPageChange(patch);
    flash('Saved');
  }

  return (
    <div className="thin-scroll h-full overflow-y-auto p-3">
      <Section title="Site">
        <label className="mb-3 block">
          <span className="ws-label">Name</span>
          <input
            className="ws-field"
            defaultValue={project.name}
            onBlur={(event) => {
              const name = event.target.value.trim();
              if (name && name !== project.name) void saveProject({ name });
            }}
          />
        </label>

        <label className="mb-3 block">
          <span className="ws-label">Public URL</span>
          <input
            className="ws-field text-[12px]"
            defaultValue={project.siteUrl ?? ''}
            placeholder="https://example.com"
            onBlur={(event) => {
              const siteUrl = event.target.value.trim();
              if (siteUrl !== (project.siteUrl ?? '')) void saveProject({ siteUrl });
            }}
          />
          <span className="mt-1 block text-[10px] leading-relaxed text-faint">
            Where the exported site will live. Needed for canonical URLs and sitemap.xml — the host
            a .zip ends up on isn&apos;t knowable from here.
          </span>
        </label>

        <FaviconField project={project} onSave={saveProject} />

        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          Published at <code className="text-muted">/s/{project.slug}</code>
        </p>
      </Section>

      <Section title="Current page">
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
        <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
          Lowercase letters, numbers and dashes, starting with /
        </p>
      </Section>

      <DesignTokens project={project} onSave={saveProject} />

      <MediaLibrary projectId={project.id} />

      <Section title="Project CSS">
        <textarea
          className="ws-field min-h-32 font-mono text-[11px] leading-relaxed"
          defaultValue={project.customCss ?? ''}
          placeholder={'.my-class {\n  color: red;\n}'}
          onBlur={(event) => void saveProject({ customCss: event.target.value })}
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
          Applied after generated styles, on every page.
        </p>
      </Section>

      {project.importedCss && (
        <Section title="Imported stylesheet">
          <textarea
            className="ws-field min-h-28 font-mono text-[11px] leading-relaxed"
            defaultValue={project.importedCss}
            onBlur={(event) => void saveProject({ importedCss: event.target.value })}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
            From the imported template. Generated styles override it, so edits here stay safe.
          </p>
        </Section>
      )}

      {status && <p className="mt-4 text-[11px] text-muted">{status}</p>}
    </div>
  );
}

/**
 * Custom properties declared by the imported template.
 *
 * A template that defines its palette in `:root` can be recoloured entirely
 * from here — the alternative is finding each hex value in a stylesheet and
 * hoping every usage was through the variable.
 */
function DesignTokens({
  project,
  onSave,
}: {
  project: EditorProject;
  onSave: (patch: Partial<EditorProject>) => Promise<void>;
}) {
  const declared = extractTokens(project.importedCss);
  const overrides = project.theme.tokens ?? {};
  const names = Object.keys({ ...declared, ...overrides }).sort();

  if (!names.length) return null;

  const update = (name: string, value: string) => {
    const next = { ...overrides };
    // Back to the declared value means there is no override to store.
    if (value === '' || value === declared[name]) delete next[name];
    else next[name] = value;
    void onSave({ theme: { ...project.theme, tokens: next } });
  };

  return (
    <Section title="Design tokens">
      <div className="flex flex-col gap-1.5">
        {names.map((name) => {
          const value = overrides[name] ?? declared[name] ?? '';
          const isColour = /^#|^rgb|^hsl/i.test(value);

          return (
            <label key={name} className="flex items-center gap-1.5">
              <code className="w-[86px] shrink-0 truncate font-mono text-[10px] text-muted" title={name}>
                {name}
              </code>
              {isColour && (
                <input
                  type="color"
                  aria-label={`${name} colour`}
                  className="h-7 w-7 shrink-0 cursor-pointer rounded border border-edge bg-panelRaised p-0.5"
                  value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
                  onChange={(event) => update(name, event.target.value)}
                />
              )}
              <input
                className="ws-field py-1 font-mono text-[11px]"
                value={value}
                onChange={(event) => update(name, event.target.value)}
              />
              {overrides[name] !== undefined && (
                <button
                  type="button"
                  title="Revert to the template's value"
                  aria-label={`Revert ${name}`}
                  className="shrink-0 text-[10px] text-faint transition-colors hover:text-white"
                  onClick={() => update(name, '')}
                >
                  ↺
                </button>
              )}
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-faint">
        From the template&apos;s <code className="text-muted">:root</code>. Changing one updates
        everything that references it.
      </p>
    </Section>
  );
}

function FaviconField({
  project,
  onSave,
}: {
  project: EditorProject;
  onSave: (patch: Partial<EditorProject>) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    // Favicons are tiny; a large upload here is a mistake worth catching.
    if (file.size > 100 * 1024) {
      setError('Favicons must be under 100 KB.');
      if (input.current) input.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => void onSave({ faviconData: String(reader.result) });
    reader.readAsDataURL(file);
    if (input.current) input.current.value = '';
  }

  return (
    <div>
      <span className="ws-label">Favicon</span>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-edge bg-[#0a0114]">
          {project.faviconData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.faviconData} alt="Current favicon" className="h-5 w-5 object-contain" />
          ) : (
            <Icon name="globe" size={15} className="text-faint" />
          )}
        </span>
        <button type="button" className="ws-btn flex-1 py-1.5 text-[12px]" onClick={() => input.current?.click()}>
          <Icon name="upload" size={14} />
          {project.faviconData ? 'Replace' : 'Upload'}
        </button>
        {project.faviconData && (
          <button
            type="button"
            className="ws-btn-danger h-8 w-8 px-0"
            title="Remove favicon"
            aria-label="Remove favicon"
            onClick={() => void onSave({ faviconData: null })}
          >
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/png,image/svg+xml,image/x-icon" className="hidden" onChange={pick} />
      {error && <p className="mt-1.5 text-[11px] text-danger">{error}</p>}
    </div>
  );
}

/**
 * Uploaded images for the project.
 *
 * Before this, an upload was reachable only from the field that created it and
 * could never be removed — with images stored inline as data URLs, that made
 * project size grow in one direction only.
 */
function MediaLibrary({ projectId }: { projectId: string }) {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/assets?projectId=${projectId}`);
    if (!response.ok) return;
    const payload: any = await response.json();
    setAssets(payload.assets ?? []);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(asset: Asset) {
    if (!confirm(`Delete ${asset.filename}? Anything still using it will show a broken image.`)) return;
    setBusy(true);
    await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' });
    await load();
    setBusy(false);
  }

  // Data URLs are ~4/3 the size of the bytes they encode.
  const totalKb = assets
    ? Math.round(assets.reduce((sum, asset) => sum + asset.data.length * 0.75, 0) / 1024)
    : 0;

  return (
    <Section title="Media">
      {assets === null ? (
        <p className="text-[11px] text-faint">Loading…</p>
      ) : assets.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-faint">
          No uploads yet. Images you add through an Image widget appear here.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="group relative aspect-square overflow-hidden rounded-md border border-edge bg-[#0a0114]"
                title={asset.filename}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.data} alt={asset.filename} className="h-full w-full object-cover" />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(asset)}
                  aria-label={`Delete ${asset.filename}`}
                  className="absolute inset-0 flex items-center justify-center bg-black/70 text-danger opacity-0 transition-opacity duration-150 hover:opacity-100 focus-visible:opacity-100"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] tabular-nums text-faint">
            {assets.length} image{assets.length === 1 ? '' : 's'} · about {totalKb} KB
          </p>
        </>
      )}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 border-b border-edge pb-4 last:border-b-0">
      <h3 className="mb-2 text-[12px] font-semibold text-neutral-200">{title}</h3>
      {children}
    </section>
  );
}
