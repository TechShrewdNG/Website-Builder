'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import Canvas, { type DropTarget } from './Canvas';
import Inspector from './Inspector';
import LayerTree from './LayerTree';
import PagesPanel, { type PageSummary } from './PagesPanel';
import SitePanel from './SitePanel';
import WidgetPalette from './WidgetPalette';
import type { DragPayload } from './dragState';
import Icon from '@/components/Icon';
import { createNode } from '@/lib/builder/widgets';
import type { ProjectTheme } from '@/lib/builder/theme';
import {
  createRoot,
  cloneWithNewIds,
  setStateStyle,
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
  theme: ProjectTheme;
  siteUrl: string | null;
  faviconData: string | null;
  headerTree: BuilderNode | null;
  footerTree: BuilderNode | null;
}

export interface EditorPage extends PageSummary {
  tree: BuilderNode;
  description: string | null;
  socialImage: string | null;
  noIndex: boolean;
}

interface Props {
  project: EditorProject;
  pages: EditorPage[];
}

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

type PanelKey = 'widgets' | 'layers' | 'pages' | 'site';

/** What the canvas is pointed at. */
export type EditTarget = { kind: 'page' } | { kind: 'header' } | { kind: 'footer' };

const LEFT_PANELS: { key: PanelKey }[] = [
  { key: 'widgets' },
  { key: 'layers' },
  { key: 'pages' },
  { key: 'site' },
];

/**
 * Autosave status. Deliberately low-contrast until something needs attention:
 * "saved" is the state it sits in almost always, and a permanently bright
 * badge there trains people to ignore the one case that matters.
 */
function SaveIndicator({ state }: { state: SaveState }) {
  const config = {
    saved: { label: 'Saved', dot: 'bg-positive/70', text: 'text-faint' },
    dirty: { label: 'Unsaved changes', dot: 'bg-muted', text: 'text-muted' },
    saving: { label: 'Saving…', dot: 'bg-accent animate-pulse', text: 'text-muted' },
    error: { label: "Couldn't save — retrying on next edit", dot: 'bg-danger', text: 'text-danger' },
  }[state];

  return (
    <span className={`flex shrink-0 items-center gap-1.5 text-[11px] ${config.text}`} role="status">
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      {config.label}
    </span>
  );
}

const AUTOSAVE_DELAY = 1200;
const HISTORY_LIMIT = 60;

export default function EditorShell({ project: initialProject, pages: initialPages }: Props) {
  const [project, setProject] = useState(initialProject);
  const [pages, setPages] = useState(initialPages);
  const [activeId, setActiveId] = useState(initialPages[0]?.id ?? '');
  // The canvas edits either a page or one of the two global sections.
  const [target, setTarget] = useState<EditTarget>({ kind: 'page' });
  const [globals, setGlobals] = useState<{ header: BuilderNode | null; footer: BuilderNode | null }>({
    header: initialProject.headerTree,
    footer: initialProject.footerTree,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');
  const [panel, setPanel] = useState<PanelKey>('widgets');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Undo/redo, per page: switching pages should not let you undo into another.
  const historyRef = useRef<Record<string, { past: BuilderNode[]; future: BuilderNode[] }>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canvasApi, setCanvasApi] = useState<{
    matches: (nodeId: string, selector: string) => boolean;
  } | null>(null);

  const activePage = pages.find((page) => page.id === activeId) ?? pages[0];

  /** The tree the canvas is editing, which is not always a page's. */
  const tree =
    target.kind === 'page' ? activePage?.tree : globals[target.kind] ?? createRoot([createNode('section')]);

  const selectedNode = useMemo(
    () => (tree && selectedId ? findNode(tree, selectedId) : null),
    [tree, selectedId],
  );

  /** Identifies the current tree for history and autosave bookkeeping. */
  const targetKey = target.kind === 'page' ? activePage?.id ?? '' : target.kind;

  // --- persistence ---------------------------------------------------------
  const save = useCallback(
    async (key: string, nextTree: BuilderNode) => {
      setSaveState('saving');
      try {
        // Globals live on the project; pages on the page.
        const isGlobal = key === 'header' || key === 'footer';
        const url = isGlobal ? `/api/projects/${initialProject.id}` : `/api/pages/${key}`;
        const body = isGlobal ? { [`${key}Tree`]: nextTree } : { tree: nextTree };

        const response = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error('save failed');
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    },
    [initialProject.id],
  );

  const scheduleSave = useCallback(
    (key: string, nextTree: BuilderNode) => {
      setSaveState('dirty');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void save(key, nextTree), AUTOSAVE_DELAY);
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
  /** Writes a tree back to wherever it came from. */
  const applyTree = useCallback(
    (next: BuilderNode) => {
      if (target.kind === 'page') {
        setPages((prev) => prev.map((page) => (page.id === targetKey ? { ...page, tree: next } : page)));
      } else {
        setGlobals((prev) => ({ ...prev, [target.kind]: next }));
      }
    },
    [target.kind, targetKey],
  );

  const commit = useCallback(
    (next: BuilderNode, options: { history?: boolean } = {}) => {
      if (!tree || !targetKey) return;

      if (options.history !== false) {
        const entry = historyRef.current[targetKey] ?? { past: [], future: [] };
        entry.past = [...entry.past, tree].slice(-HISTORY_LIMIT);
        entry.future = [];
        historyRef.current[targetKey] = entry;
      }

      applyTree(next);
      scheduleSave(targetKey, next);
    },
    [tree, targetKey, applyTree, scheduleSave],
  );

  const undo = useCallback(() => {
    if (!tree || !targetKey) return;
    const entry = historyRef.current[targetKey];
    if (!entry?.past.length) return;

    const previous = entry.past[entry.past.length - 1];
    entry.past = entry.past.slice(0, -1);
    entry.future = [tree, ...entry.future].slice(0, HISTORY_LIMIT);

    applyTree(previous);
    scheduleSave(targetKey, previous);
  }, [tree, targetKey, applyTree, scheduleSave]);

  const redo = useCallback(() => {
    if (!tree || !targetKey) return;
    const entry = historyRef.current[targetKey];
    if (!entry?.future.length) return;

    const next = entry.future[0];
    entry.future = entry.future.slice(1);
    entry.past = [...entry.past, tree].slice(-HISTORY_LIMIT);

    applyTree(next);
    scheduleSave(targetKey, next);
  }, [tree, targetKey, applyTree, scheduleSave]);

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

  /** Reorder or reparent from the outline, which reaches nodes a click can't. */
  const handleLayerMove = useCallback(
    (nodeId: string, targetId: string, position: 'before' | 'after' | 'inside') => {
      if (!tree) return;

      if (position === 'inside') {
        const container = findNode(tree, targetId);
        if (!container) return;
        const next = moveNode(tree, nodeId, targetId, container.children.length);
        if (next !== tree) commit(next);
        return;
      }

      const parent = findParent(tree, targetId);
      if (!parent) return;
      const index =
        parent.children.findIndex((child) => child.id === targetId) + (position === 'after' ? 1 : 0);

      const next = moveNode(tree, nodeId, parent.id, index);
      if (next === tree) setNotice("That widget can't go there.");
      else commit(next);
    },
    [tree, commit],
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

  /**
   * Node clipboard.
   *
   * A module-level ref rather than the system clipboard: a BuilderNode is a
   * tree, not text, and round-tripping it through the OS clipboard would mean
   * serialising it somewhere a paste into another app would dump JSON.
   * Kept outside React state so copying never triggers a re-render.
   */
  const clipboard = useRef<BuilderNode | null>(null);

  const copySelection = useCallback(() => {
    if (!tree || !selectedId) return false;
    const node = findNode(tree, selectedId);
    if (!node || node.id === ROOT_ID) return false;
    clipboard.current = JSON.parse(JSON.stringify(node)) as BuilderNode;
    setNotice(`Copied ${node.type}`);
    return true;
  }, [tree, selectedId]);

  const pasteClipboard = useCallback(() => {
    const source = clipboard.current;
    if (!tree || !source) return;

    // Fresh ids, or pasting twice would put duplicate ids in one document and
    // every generated CSS rule would target both.
    const copy = cloneWithNewIds(source);

    // Prefer pasting after the selection; fall back to inside it, then root.
    const parent = selectedId ? findParent(tree, selectedId) : null;
    let next = tree;

    if (selectedId && parent) {
      const index = parent.children.findIndex((child) => child.id === selectedId) + 1;
      next = insertNode(tree, parent.id, copy, index);
    }
    if (next === tree && selectedId) next = insertNode(tree, selectedId, copy, 0);
    if (next === tree) next = insertNode(tree, ROOT_ID, copy, tree.children.length);

    if (next === tree) {
      setNotice(`A ${copy.type} can't go there.`);
      return;
    }
    commit(next);
    setSelectedId(copy.id);
  }, [tree, selectedId, commit]);

  /** One clipboard entry point, shared by the window and the canvas iframe. */
  const handleClipboard = useCallback(
    (action: 'copy' | 'cut' | 'paste') => {
      if (action === 'paste') {
        pasteClipboard();
        return;
      }
      if (!copySelection()) return;
      if (action === 'cut' && selectedId) handleDelete(selectedId);
    },
    [copySelection, pasteClipboard, selectedId, handleDelete],
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

      // Only intercept clipboard keys when the caret isn't in a text field,
      // or copying from the inspector would copy the selected node instead.
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable === true;
      if (typing) return;

      const key = event.key.toLowerCase();
      if (key === 'c' || key === 'x' || key === 'v') {
        event.preventDefault();
        handleClipboard(key === 'c' ? 'copy' : key === 'x' ? 'cut' : 'paste');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, save, activePage, selectedId, tree, commit, handleClipboard]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // --- pages ---------------------------------------------------------------
  async function createPage(title: string, path: string, templateId: string) {
    const response = await fetch(`/api/projects/${project.id}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, path, templateId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? 'Could not add the page');

    setPages((prev) => [...prev, { ...payload.page, tree: payload.page.tree as BuilderNode }]);
    setActiveId(payload.page.id);
    setTarget({ kind: 'page' });
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

  const updateSeo = useCallback(
    (patch: Partial<{ description: string | null; socialImage: string | null; noIndex: boolean }>) => {
      const pageId = activePage?.id;
      if (!pageId) return;

      setPages((prev) => prev.map((page) => (page.id === pageId ? { ...page, ...patch } : page)));

      if (seoTimer.current) clearTimeout(seoTimer.current);
      seoTimer.current = setTimeout(() => {
        void fetch(`/api/pages/${pageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
      }, AUTOSAVE_DELAY);
    },
    [activePage?.id],
  );

  const restoreRevision = useCallback(
    async (revisionId: string) => {
      const pageId = activePage?.id;
      if (!pageId) return;

      const response = await fetch(`/api/pages/${pageId}/revisions/${revisionId}`, { method: 'POST' });
      if (!response.ok) {
        setNotice('Could not restore that snapshot');
        return;
      }
      const payload = await response.json();
      const restored = payload.page.tree as BuilderNode;

      setPages((prev) => prev.map((page) => (page.id === pageId ? { ...page, tree: restored } : page)));
      setSelectedId(null);
      setNotice('Snapshot restored');
    },
    [activePage?.id],
  );

  /** Persists the theme (tokens and rule overrides), debounced like styles. */
  const saveTheme = useCallback(
    (next: ProjectTheme) => {
      setProject((prev) => ({ ...prev, theme: next }));
      if (themeTimer.current) clearTimeout(themeTimer.current);
      themeTimer.current = setTimeout(() => {
        void fetch(`/api/projects/${initialProject.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: next }),
        });
      }, AUTOSAVE_DELAY);
    },
    [initialProject.id],
  );

  const handleRuleChange = useCallback(
    (selector: string, declarations: StyleMap) => {
      const overrides = { ...(project.theme.ruleOverrides ?? {}) };
      // An empty override is the same as none; keeping it would render an
      // empty rule and make the "edited" badge lie.
      if (Object.keys(declarations).length === 0) delete overrides[selector];
      else overrides[selector] = declarations;

      saveTheme({ ...project.theme, ruleOverrides: overrides });
    },
    [project.theme, saveTheme],
  );

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
    return <p className="p-8 text-sm text-muted">This project has no pages.</p>;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* ---- top bar ---- */}
      <header className="relative z-20 flex shrink-0 items-center gap-3 border-b border-edge bg-panel px-3 py-2.5">
        <Link
          href="/dashboard"
          title="Back to your sites"
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-panelRaised hover:text-white"
        >
          <Icon name="arrowLeft" size={17} />
        </Link>

        <div className="flex min-w-0 items-baseline gap-2.5">
          <span className="truncate text-[13px] font-semibold text-white">{project.name}</span>
          <SaveIndicator state={saveState} />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Breakpoint switch: an icon each, since the labels read as tabs. */}
          <div className="flex items-center gap-0.5 rounded-lg border border-edge bg-panelRaised p-0.5">
            {BREAKPOINTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setBreakpoint(value)}
                title={`${value} styles`}
                aria-pressed={breakpoint === value}
                className={`flex h-7 w-8 items-center justify-center rounded-md transition-colors duration-150 ${
                  breakpoint === value
                    ? 'bg-accent text-accentInk'
                    : 'text-muted hover:bg-[#2d1444] hover:text-white'
                }`}
              >
                <Icon name={value} size={16} />
              </button>
            ))}
          </div>

          <div className="mx-1 h-6 w-px bg-edge" aria-hidden="true" />

          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-panelRaised hover:text-white"
            onClick={undo}
            title="Undo (Ctrl/Cmd+Z)"
          >
            <Icon name="undo" size={17} />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-panelRaised hover:text-white"
            onClick={redo}
            title="Redo (Ctrl/Cmd+Shift+Z)"
          >
            <Icon name="redo" size={17} />
          </button>

          <div className="mx-1 h-6 w-px bg-edge" aria-hidden="true" />

          <a className="ws-btn h-8 px-2.5 text-[13px]" href={`/api/projects/${project.id}/export`}>
            <Icon name="download" size={15} />
            Export .zip
          </a>

          {project.published && (
            <Link className="ws-btn h-8 px-2.5 text-[13px]" href={`/s/${project.slug}`} target="_blank">
              <Icon name="external" size={15} />
              View live
            </Link>
          )}

          <button
            type="button"
            className="ws-btn-primary h-8 px-3 text-[13px]"
            onClick={togglePublish}
            disabled={publishing}
          >
            <Icon name="globe" size={15} />
            {publishing ? 'Working…' : project.published ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---- left panel ---- */}
        <aside className="flex w-[264px] shrink-0 flex-col border-r border-edge bg-panel">
          <nav className="flex shrink-0 gap-0.5 border-b border-edge px-2 py-1.5">
            {/* Labels only: four icon+label pairs overflow 264px, and these
                words are short enough to be their own affordance. */}
            {LEFT_PANELS.map(({ key }) => (
              <button
                key={key}
                type="button"
                onClick={() => setPanel(key)}
                aria-pressed={panel === key}
                className={`flex-1 rounded-md py-1.5 text-[12px] font-medium capitalize transition-colors duration-150 ${
                  panel === key
                    ? 'bg-panelRaised text-white'
                    : 'text-muted hover:bg-panelRaised/60 hover:text-neutral-200'
                }`}
              >
                {key}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1">
            {panel === 'widgets' && <WidgetPalette onAdd={handleAdd} />}
            {panel === 'layers' && (
              <LayerTree
                tree={tree}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMove={handleLayerMove}
              />
            )}
            {panel === 'pages' && (
              <PagesPanel
                pages={pages.map(({ id, title, path }) => ({ id, title, path }))}
                activeId={activeId}
                target={target}
                seo={{
                  description: activePage.description,
                  socialImage: activePage.socialImage,
                  noIndex: activePage.noIndex,
                }}
                hasHeader={Boolean(globals.header)}
                hasFooter={Boolean(globals.footer)}
                onSelect={(id) => {
                  setActiveId(id);
                  setSelectedId(null);
                }}
                onTargetChange={(next) => {
                  setTarget(next);
                  setSelectedId(null);
                }}
                onCreate={createPage}
                onDelete={deletePage}
                onSeoChange={updateSeo}
                onRestore={restoreRevision}
              />
            )}
            {panel === 'site' && (
              <SitePanel
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
            // Globals frame the page so the canvas matches what ships, but
            // they stay read-only here: they're edited on their own target.
            chrome={
              target.kind === 'page' ? { header: globals.header, footer: globals.footer } : undefined
            }
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
            onClipboard={handleClipboard}
            onReady={setCanvasApi}
            theme={project.theme}
          />
        </main>

        {/* ---- right panel ---- */}
        <aside className="w-[300px] shrink-0 border-l border-edge bg-panel">
          <Inspector
            node={selectedNode}
            projectId={project.id}
            pages={pages.map(({ title, path }) => ({ title, path }))}
            breakpoint={breakpoint}
            onPropsChange={(patch) => selectedId && commit(setProps(tree, selectedId, patch))}
            onStyleChange={(patch: StyleMap) => selectedId && commit(setStyle(tree, selectedId, breakpoint, patch))}
            onStateStyleChange={(state, patch) =>
              selectedId && commit(setStateStyle(tree, selectedId, state, patch))
            }
            css={{
              importedCss: project.importedCss,
              overrides: project.theme.ruleOverrides ?? {},
              matches:
                canvasApi && selectedId
                  ? (selector: string) => canvasApi.matches(selectedId, selector)
                  : null,
              onRuleChange: handleRuleChange,
            }}
            onDuplicate={() => selectedId && commit(duplicateNode(tree, selectedId))}
            onDelete={() => selectedId && handleDelete(selectedId)}
          />
        </aside>
      </div>

      {notice && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 animate-ws-rise rounded-lg border border-edgeStrong bg-panelRaised px-4 py-2.5 text-[13px] text-white shadow-[var(--ws-shadow-lg)]"
        >
          {notice}
        </div>
      )}
    </div>
  );
}
