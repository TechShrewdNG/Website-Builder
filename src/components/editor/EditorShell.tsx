'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import Canvas, { type DropTarget } from './Canvas';
import Inspector from './Inspector';
import LayerTree from './LayerTree';
import PagesPanel, { type PageSummary } from './PagesPanel';
import ProjectSettings from './ProjectSettings';
import WidgetPalette from './WidgetPalette';
import type { DragPayload } from './dragState';
import { createNode } from '@/lib/builder/widgets';
import {
  cloneWithNewIds,
  duplicateNode,
  findNode,
  findParent,
  insertNode,
  moveNode,
  removeNode,
  setProps,
  setStyle,
} from '@/lib/builder/tree';
import { BREAKPOINTS, ROOT_ID, type BuilderNode, type Breakpoint, type StyleMap, type WidgetType } from '@/lib/builder/types';

export interface EditorProject {
  id: string;
  name: string;
  slug: string;
  published: boolean;
  importedCss: string | null;
  customCss: string | null;
  externalStylesheets: string[];
}

export interface EditorPage extends PageSummary {
  tree: BuilderNode;
}

interface Props {
  project: EditorProject;
  pages: EditorPage[];
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

const AUTOSAVE_DELAY = 1200;
const HISTORY_LIMIT = 60;

export default function EditorShell({ project: initialProject, pages: initialPages }: Props) {
  const [project, setProject] = useState(initialProject);
  const [pages, setPages] = useState(initialPages);
  const [activeId, setActiveId] = useState(initialPages[0]?.id ?? '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');
  const [panel, setPanel] = useState<'widgets' | 'layers' | 'pages' | 'settings'>('widgets');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Undo/redo, per page: switching pages should not let you undo into another.
  const historyRef = useRef<Record<string, { past: BuilderNode[]; future: BuilderNode[] }>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activePage = pages.find((page) => page.id === activeId) ?? pages[0];
  const tree = activePage?.tree;
  const selectedNode = useMemo(
    () => (tree && selectedId ? findNode(tree, selectedId) : null),
    [tree, selectedId],
  );

  // --- persistence ---------------------------------------------------------
  const save = useCallback(
    async (pageId: string, nextTree: BuilderNode) => {
      setSaveState('saving');
      try {
        const response = await fetch(`/api/pages/${pageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tree: nextTree }),
        });
        if (!response.ok) throw new Error('save failed');
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    },
    [],
  );

  const scheduleSave = useCallback(
    (pageId: string, nextTree: BuilderNode) => {
      setSaveState('dirty');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void save(pageId, nextTree), AUTOSAVE_DELAY);
    },
    [save],
  );

  // A pending autosave must not be lost to a page switch or a closed tab.
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    window.addEventListener('beforeunload', flush);
    return () => {
      flush();
      window.removeEventListener('beforeunload', flush);
    };
  }, []);

  // --- tree mutation -------------------------------------------------------
  const commit = useCallback(
    (next: BuilderNode, options: { history?: boolean } = {}) => {
      if (!activePage) return;
      const pageId = activePage.id;

      if (options.history !== false) {
        const entry = historyRef.current[pageId] ?? { past: [], future: [] };
        entry.past = [...entry.past, activePage.tree].slice(-HISTORY_LIMIT);
        entry.future = [];
        historyRef.current[pageId] = entry;
      }

      setPages((prev) => prev.map((page) => (page.id === pageId ? { ...page, tree: next } : page)));
      scheduleSave(pageId, next);
    },
    [activePage, scheduleSave],
  );

  const undo = useCallback(() => {
    if (!activePage) return;
    const entry = historyRef.current[activePage.id];
    if (!entry?.past.length) return;

    const previous = entry.past[entry.past.length - 1];
    entry.past = entry.past.slice(0, -1);
    entry.future = [activePage.tree, ...entry.future].slice(0, HISTORY_LIMIT);

    setPages((prev) => prev.map((page) => (page.id === activePage.id ? { ...page, tree: previous } : page)));
    scheduleSave(activePage.id, previous);
  }, [activePage, scheduleSave]);

  const redo = useCallback(() => {
    if (!activePage) return;
    const entry = historyRef.current[activePage.id];
    if (!entry?.future.length) return;

    const next = entry.future[0];
    entry.future = entry.future.slice(1);
    entry.past = [...entry.past, activePage.tree].slice(-HISTORY_LIMIT);

    setPages((prev) => prev.map((page) => (page.id === activePage.id ? { ...page, tree: next } : page)));
    scheduleSave(activePage.id, next);
  }, [activePage, scheduleSave]);

  // --- canvas interactions -------------------------------------------------
  const handleDrop = useCallback(
    (target: DropTarget, payload: DragPayload) => {
      if (!tree) return;

      if (payload.kind === 'move') {
        commit(moveNode(tree, payload.nodeId, target.parentId, target.index));
        setSelectedId(payload.nodeId);
        return;
      }

      const node = payload.kind === 'new' ? createNode(payload.widget) : cloneWithNewIds(payload.node);
      commit(insertNode(tree, target.parentId, node, target.index));
      setSelectedId(node.id);
    },
    [tree, commit],
  );

  /** Click-to-add: into the selected container, else onto the end of the page. */
  const handleAdd = useCallback(
    (type: WidgetType) => {
      if (!tree) return;
      const node = createNode(type);

      let parentId = ROOT_ID;
      let index = tree.children.length;

      if (selectedNode) {
        const parent = findParent(tree, selectedNode.id);
        // Drop inside the selection when it can hold the widget, otherwise
        // place it directly after the selection.
        if (insertNode(tree, selectedNode.id, node, 0) !== tree) {
          parentId = selectedNode.id;
          index = selectedNode.children.length;
        } else if (parent) {
          parentId = parent.id;
          index = parent.children.findIndex((child) => child.id === selectedNode.id) + 1;
        }
      }

      const next = insertNode(tree, parentId, node, index);
      if (next === tree) {
        setNotice(`A ${type} can't go there. Select a section or container first.`);
        return;
      }
      commit(next);
      setSelectedId(node.id);
    },
    [tree, selectedNode, commit],
  );

  const handleTextEdit = useCallback(
    (id: string, value: string) => {
      if (!tree) return;
      const node = findNode(tree, id);
      if (!node) return;
      commit(setProps(tree, id, node.type === 'heading' ? { text: value } : { html: value }));
    },
    [tree, commit],
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (!tree || id === ROOT_ID) return;
      commit(removeNode(tree, id));
      setSelectedId(null);
    },
    [tree, commit],
  );

  // --- keyboard shortcuts --------------------------------------------------
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier) return;

      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (activePage) void save(activePage.id, activePage.tree);
      }
      if (event.key.toLowerCase() === 'd' && selectedId && tree) {
        event.preventDefault();
        commit(duplicateNode(tree, selectedId));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, save, activePage, selectedId, tree, commit]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // --- pages ---------------------------------------------------------------
  async function createPage(title: string, path: string) {
    const response = await fetch(`/api/projects/${project.id}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, path }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? 'Could not add the page');

    setPages((prev) => [...prev, { ...payload.page, tree: payload.page.tree as BuilderNode }]);
    setActiveId(payload.page.id);
    setSelectedId(null);
  }

  async function deletePage(id: string) {
    const response = await fetch(`/api/pages/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setNotice(payload.error ?? 'Could not delete the page');
      return;
    }
    setPages((prev) => prev.filter((page) => page.id !== id));
    if (activeId === id) setActiveId((prev) => pages.find((page) => page.id !== prev)?.id ?? '');
  }

  async function togglePublish() {
    setPublishing(true);
    try {
      // Publishing snapshots what's saved, so flush any pending edit first.
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (activePage) await save(activePage.id, activePage.tree);

      const response = await fetch(`/api/projects/${project.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !project.published }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Publish failed');

      setProject((prev) => ({ ...prev, published: payload.published }));
      setNotice(payload.published ? `Published at /s/${project.slug}` : 'Site unpublished');
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  if (!activePage || !tree) {
    return <p className="p-8 text-sm text-neutral-400">This project has no pages.</p>;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ---- top bar ---- */}
      <header className="flex shrink-0 items-center gap-3 border-b border-edge bg-panel px-3 py-2">
        <Link href="/dashboard" className="text-sm text-neutral-400 hover:text-white">
          ←
        </Link>
        <span className="truncate text-sm font-medium">{project.name}</span>

        <span className="text-xs text-neutral-500">
          {
            {
              saved: 'All changes saved',
              dirty: 'Unsaved changes',
              saving: 'Saving…',
              error: 'Save failed — retrying on next edit',
            }[saveState]
          }
        </span>

        <div className="ml-auto flex items-center gap-1">
          <div className="mr-2 flex rounded border border-edge">
            {BREAKPOINTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setBreakpoint(value)}
                title={`${value} styles`}
                className={`px-2.5 py-1 text-xs capitalize ${
                  breakpoint === value ? 'bg-accent text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <button type="button" className="ws-btn px-2 py-1 text-xs" onClick={undo} title="Undo (Ctrl/Cmd+Z)">
            Undo
          </button>
          <button type="button" className="ws-btn px-2 py-1 text-xs" onClick={redo} title="Redo (Ctrl/Cmd+Shift+Z)">
            Redo
          </button>

          <a className="ws-btn px-2 py-1 text-xs" href={`/api/projects/${project.id}/export`}>
            Export .zip
          </a>

          {project.published && (
            <Link className="ws-btn px-2 py-1 text-xs" href={`/s/${project.slug}`} target="_blank">
              View live
            </Link>
          )}

          <button type="button" className="ws-btn-primary px-3 py-1 text-xs" onClick={togglePublish} disabled={publishing}>
            {publishing ? 'Working…' : project.published ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---- left panel ---- */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-edge bg-panel">
          <nav className="flex shrink-0 border-b border-edge">
            {(['widgets', 'layers', 'pages', 'settings'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setPanel(value)}
                className={`flex-1 py-2 text-[11px] capitalize transition-colors ${
                  panel === value ? 'border-b-2 border-accent text-white' : 'text-neutral-500 hover:text-white'
                }`}
              >
                {value}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1">
            {panel === 'widgets' && <WidgetPalette onAdd={handleAdd} />}
            {panel === 'layers' && <LayerTree tree={tree} selectedId={selectedId} onSelect={setSelectedId} />}
            {panel === 'pages' && (
              <PagesPanel
                pages={pages.map(({ id, title, path }) => ({ id, title, path }))}
                activeId={activeId}
                onSelect={(id) => {
                  setActiveId(id);
                  setSelectedId(null);
                }}
                onCreate={createPage}
                onDelete={deletePage}
              />
            )}
            {panel === 'settings' && (
              <ProjectSettings
                project={project}
                page={{ id: activePage.id, title: activePage.title, path: activePage.path }}
                onProjectChange={(patch) => setProject((prev) => ({ ...prev, ...patch }))}
                onPageChange={(patch) =>
                  setPages((prev) => prev.map((page) => (page.id === activePage.id ? { ...page, ...patch } : page)))
                }
              />
            )}
          </div>
        </aside>

        {/* ---- canvas ---- */}
        <main className="min-w-0 flex-1">
          <Canvas
            tree={tree}
            importedCss={project.importedCss}
            customCss={project.customCss}
            externalStylesheets={project.externalStylesheets}
            selectedId={selectedId}
            breakpoint={breakpoint}
            onSelect={setSelectedId}
            onDrop={handleDrop}
            onTextEdit={handleTextEdit}
            onDelete={handleDelete}
            onUndo={undo}
            onRedo={redo}
          />
        </main>

        {/* ---- right panel ---- */}
        <aside className="w-72 shrink-0 border-l border-edge bg-panel">
          <Inspector
            node={selectedNode}
            projectId={project.id}
            breakpoint={breakpoint}
            onPropsChange={(patch) => selectedId && commit(setProps(tree, selectedId, patch))}
            onStyleChange={(patch: StyleMap) => selectedId && commit(setStyle(tree, selectedId, breakpoint, patch))}
            onDuplicate={() => selectedId && commit(duplicateNode(tree, selectedId))}
            onDelete={() => selectedId && handleDelete(selectedId)}
          />
        </aside>
      </div>

      {notice && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 rounded bg-black/85 px-4 py-2 text-sm text-white shadow-lg"
        >
          {notice}
        </div>
      )}
    </div>
  );
}
