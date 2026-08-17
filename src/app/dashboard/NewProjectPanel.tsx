'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { importHtml, type ImportResult } from '@/lib/builder/importer';
import {
  importBundle,
  unzip,
  createAssetExtractor,
  applyAssetResolution,
  type BundleResult,
  type BundleFile,
  type ExtractedAsset,
} from '@/lib/builder/bundle';
import Icon from '@/components/Icon';

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
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ result: ImportResult; filename: string } | null>(null);
  const [bundle, setBundle] = useState<{ result: BundleResult; label: string } | null>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  /**
   * A template's worth of full-size photos, inlined as data URLs and sent as
   * one JSON body, can run to tens of megabytes — comfortably past what a
   * single request should carry, and past what some hosts allow at all. So a
   * bundle is created in three small steps instead: the trees go up with
   * placeholders standing in for each image, then every image uploads on its
   * own through the existing (already size-checked) asset endpoint, then each
   * page is patched with the placeholders swapped for the uploaded URLs.
   */
  async function createFromBundle() {
    if (!bundle) return;
    setBusy(true);
    setError(null);

    try {
      const [home, ...rest] = bundle.result.pages;
      const extractor = createAssetExtractor();
      extractor.extract(home.root);
      rest.forEach((page) => extractor.extract(page.root));

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          imported: {
            tree: home.root,
            title: home.title,
            css: bundle.result.css,
            externalStylesheets: bundle.result.externalStylesheets,
            pages: rest.map((page) => ({ title: page.title, path: page.path, tree: page.root })),
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Could not create the project');

      const project = payload.project as { id: string; pages: { id: string; path: string; tree: unknown }[] };
      const assets: ExtractedAsset[] = extractor.assets;

      if (assets.length) {
        const resolved = new Map<string, string>();
        let uploaded = 0;
        let failed = 0;

        // Sequential rather than Promise.all: a hundred-plus concurrent
        // multipart uploads is its own way to overwhelm a request, and this
        // only has to be fast enough not to feel stuck, not instant.
        for (const asset of assets) {
          setProgress(`Uploading images… ${uploaded + failed + 1}/${assets.length}`);
          try {
            const blob = await (await fetch(asset.dataUrl)).blob();
            const form = new FormData();
            form.append('projectId', project.id);
            form.append('file', new File([blob], asset.filename, { type: asset.mimeType }));

            const uploadRes = await fetch('/api/assets', { method: 'POST', body: form });
            const uploadPayload = await uploadRes.json().catch(() => ({}));
            if (!uploadRes.ok) throw new Error(uploadPayload.error ?? 'Upload failed');

            resolved.set(asset.placeholder, uploadPayload.asset.data);
            uploaded += 1;
          } catch {
            failed += 1;
          }
        }

        setProgress('Saving pages…');
        for (const page of project.pages) {
          const tree = page.tree as Parameters<typeof applyAssetResolution>[0];
          applyAssetResolution(tree, resolved);
          await fetch(`/api/pages/${page.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tree }),
          });
        }

        if (failed) {
          setError(
            `Created the site, but ${failed} of ${assets.length} image${assets.length === 1 ? '' : 's'} were too large to upload (2 MB limit) and were left blank. Replace them from the Media panel.`,
          );
          // The site exists and is usable; surface the shortfall but still open it.
        }
      }

      router.push(`/editor/${project.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

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

  async function loadBundle(files: BundleFile[], label: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await importBundle(files);
      if (!result.pages.length) throw new Error('No .html files found in that folder.');

      setBundle({ result, label });
      setPending(null);
      if (!name) setName(result.pages[0].title || label);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read that folder');
    } finally {
      setBusy(false);
    }
  }

  async function handleFolder(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;

    // webkitRelativePath includes the chosen folder itself; drop it so paths
    // match what the HTML references.
    const files: BundleFile[] = selected.map((file) => ({
      path: (file.webkitRelativePath || file.name).split('/').slice(1).join('/') || file.name,
      blob: file,
    }));

    await loadBundle(files, selected[0].webkitRelativePath?.split('/')[0] ?? 'folder');
    if (folderInput.current) folderInput.current.value = '';
  }

  async function handleZip(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await loadBundle(await unzip(file), file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read that archive');
    }
    if (zipInput.current) zipInput.current.value = '';
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    try {
      const result = importHtml(await file.text());
      setPending({ result, filename: file.name });
      setBundle(null);
      if (!name) setName(result.title || file.name.replace(/\.html?$/i, ''));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read that file');
    } finally {
      // Allows re-selecting the same file after a failed attempt.
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  function buildPayload(): Record<string, unknown> {
    if (pending) {
      return {
        name: name.trim(),
        imported: {
          tree: pending.result.root,
          title: pending.result.title,
          css: pending.result.css,
          externalStylesheets: pending.result.externalStylesheets,
        },
      };
    }
    return { name: name.trim() };
  }

  return (
    <section className="ws-card overflow-hidden">
      <div className="border-b border-edge px-5 py-3.5">
        <h2 className="text-[13px] font-semibold text-white">Start a new site</h2>
        <p className="mt-0.5 text-[12px] text-faint">
          Build from an empty page, or bring in HTML you already have.
        </p>
      </div>

      <div className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="ws-label" htmlFor="project-name">
              Site name
            </label>
            <input
              id="project-name"
              className="ws-field"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ridgeline Coffee"
            />
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className="ws-btn-primary h-[38px]"
              disabled={busy || !name.trim()}
              onClick={() => (bundle ? createFromBundle() : create(buildPayload()))}
            >
              <Icon name="plus" size={15} />
              {busy
                ? (progress ?? 'Creating…')
                : bundle
                  ? `Create ${bundle.result.pages.length}-page site`
                  : pending
                    ? 'Create from import'
                    : 'Create blank site'}
            </button>

            <button
              type="button"
              className="ws-btn h-[38px]"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              title="A single .html file"
            >
              <Icon name="upload" size={15} />
              HTML file…
            </button>

            <button
              type="button"
              className="ws-btn h-[38px]"
              disabled={busy}
              onClick={() => folderInput.current?.click()}
              title="A template folder, with its CSS and images"
            >
              <Icon name="pages" size={15} />
              Folder…
            </button>

            <button
              type="button"
              className="ws-btn h-[38px]"
              disabled={busy}
              onClick={() => zipInput.current?.click()}
              title="A .zip of a template"
            >
              <Icon name="download" size={15} />
              .zip…
            </button>
          </div>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept=".html,.htm,text/html"
          className="hidden"
          onChange={handleFile}
        />
        <input
          ref={folderInput}
          type="file"
          className="hidden"
          onChange={handleFolder}
          // Not in React's JSX types, but supported by every major browser.
          {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        />
        <input ref={zipInput} type="file" accept=".zip,application/zip" className="hidden" onChange={handleZip} />

        {pending && (
          <div className="mt-4 animate-ws-rise rounded-lg border border-accent/25 bg-accent/[0.06] p-3.5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 items-start gap-2.5 text-[13px] text-neutral-200">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-accent" />
                <span>
                  Parsed <strong className="font-semibold text-white">{pending.filename}</strong> —{' '}
                  <span className="tabular-nums">{countNodes(pending.result)}</span> elements
                  {pending.result.css ? ', stylesheet preserved' : ''}
                </span>
              </span>
              <button
                type="button"
                className="shrink-0 text-[12px] text-muted transition-colors duration-150 hover:text-white"
                onClick={() => setPending(null)}
              >
                Discard
              </button>
            </div>

            {pending.result.warnings.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5 border-t border-accent/15 pt-3">
                {pending.result.warnings.map((warning) => (
                  <li key={warning} className="flex gap-2 text-[11.5px] leading-relaxed text-muted">
                    <span aria-hidden="true" className="text-accent">
                      –
                    </span>
                    {warning}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {bundle && (
          <div className="mt-4 animate-ws-rise rounded-lg border border-accent/25 bg-accent/[0.06] p-3.5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 items-start gap-2.5 text-[13px] text-neutral-200">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-accent" />
                <span>
                  Read <strong className="font-semibold text-white">{bundle.label}</strong> —{' '}
                  <span className="tabular-nums">{bundle.result.pages.length}</span> page
                  {bundle.result.pages.length === 1 ? '' : 's'},{' '}
                  <span className="tabular-nums">{bundle.result.resolvedAssets}</span> asset
                  {bundle.result.resolvedAssets === 1 ? '' : 's'} resolved
                </span>
              </span>
              <button
                type="button"
                className="shrink-0 text-[12px] text-muted transition-colors duration-150 hover:text-white"
                onClick={() => setBundle(null)}
              >
                Discard
              </button>
            </div>

            <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-accent/15 pt-3">
              {bundle.result.pages.map((bundlePage) => (
                <li
                  key={bundlePage.path}
                  className="rounded bg-panelRaised px-2 py-0.5 font-mono text-[10px] text-muted"
                  title={bundlePage.file}
                >
                  {bundlePage.path}
                </li>
              ))}
            </ul>

            {bundle.result.missing.length > 0 && (
              <div className="mt-3 border-t border-accent/15 pt-3">
                <p className="text-[11.5px] font-medium text-neutral-200">
                  {bundle.result.missing.length} reference
                  {bundle.result.missing.length === 1 ? '' : 's'} couldn&apos;t be resolved
                </p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {bundle.result.missing.slice(0, 6).map((entry) => (
                    <li key={`${entry.kind}:${entry.ref}`} className="font-mono text-[10.5px] text-muted">
                      {entry.kind === 'stylesheet' ? 'css' : 'img'} · {entry.ref}
                    </li>
                  ))}
                  {bundle.result.missing.length > 6 && (
                    <li className="text-[10.5px] text-faint">
                      and {bundle.result.missing.length - 6} more
                    </li>
                  )}
                </ul>
                <p className="mt-2 text-[11px] leading-relaxed text-faint">
                  The paths are kept as they are — they may exist on the server this site is going
                  to. Upload replacements from the Media panel, or fix the paths per element.
                </p>
              </div>
            )}

            {bundle.result.warnings.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5 border-t border-accent/15 pt-3">
                {bundle.result.warnings.map((warning) => (
                  <li key={warning} className="flex gap-2 text-[11.5px] leading-relaxed text-muted">
                    <span aria-hidden="true" className="text-accent">
                      –
                    </span>
                    {warning}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
          >
            {error}
          </p>
        )}
      </div>
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
