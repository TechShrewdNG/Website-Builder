'use client';

import { useCallback, useEffect, useRef } from 'react';

import { compileCss, inLayer, BASE_CSS, LAYER_ORDER } from '@/lib/builder/css';
import { renderNode, WIDGET_CSS } from '@/lib/builder/render';
import { RUNTIME_JS } from '@/lib/builder/runtime';
import { canAcceptChild, type BuilderNode, type Breakpoint, ROOT_ID } from '@/lib/builder/types';
import { findNode } from '@/lib/builder/tree';
import { dragState, type DragPayload } from './dragState';

export interface DropTarget {
  parentId: string;
  index: number;
}

interface Props {
  tree: BuilderNode;
  importedCss?: string | null;
  customCss?: string | null;
  externalStylesheets?: string[];
  selectedId: string | null;
  breakpoint: Breakpoint;
  onSelect: (id: string | null) => void;
  onDrop: (target: DropTarget, payload: DragPayload) => void;
  onTextEdit: (id: string, value: string) => void;
  onDelete: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
}

/** Widths the canvas is constrained to per breakpoint. */
const FRAME_WIDTH: Record<Breakpoint, string> = {
  desktop: '100%',
  tablet: '1024px',
  mobile: '390px',
};

/** Chrome shown only inside the editor; never part of an export. */
const EDITOR_CSS = `
[data-ws]:not([data-ws="${ROOT_ID}"]):hover { outline: 1px dashed rgba(99,102,241,.7); outline-offset: -1px; }
[data-ws-selected="true"] { outline: 2px solid #6366f1 !important; outline-offset: -2px; }
[data-ws-editing="true"] { outline: 2px solid #22c55e !important; cursor: text; }
.ws-empty-hint {
  display: flex; align-items: center; justify-content: center;
  min-height: 72px; margin: 4px; padding: 12px;
  border: 1px dashed #b3b5c6; border-radius: 6px;
  color: #8b8d9e; font: 500 13px system-ui, sans-serif;
}
[data-ws-drop="inside"] { box-shadow: inset 0 0 0 2px #22c55e; }
[data-ws-drop="before"] { box-shadow: 0 -3px 0 0 #22c55e; }
[data-ws-drop="after"] { box-shadow: 0 3px 0 0 #22c55e; }
[data-ws-drop="before-x"] { box-shadow: -3px 0 0 0 #22c55e; }
[data-ws-drop="after-x"] { box-shadow: 3px 0 0 0 #22c55e; }
body { min-height: 100vh; }
`;

export default function Canvas({
  tree,
  importedCss,
  customCss,
  externalStylesheets,
  selectedId,
  breakpoint,
  onSelect,
  onDrop,
  onTextEdit,
  onDelete,
  onUndo,
  onRedo,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  // The latest tree, readable from event listeners that are bound only once.
  const treeRef = useRef(tree);
  treeRef.current = tree;
  const dropRef = useRef<DropTarget | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const clearDropMarkers = useCallback((doc: Document) => {
    doc.querySelectorAll('[data-ws-drop]').forEach((el) => el.removeAttribute('data-ws-drop'));
  }, []);

  // --- one-time document bootstrap -----------------------------------------
  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!frame || !doc || readyRef.current) return;

    doc.open();
    doc.write(
      '<!doctype html><html><head><meta charset="utf-8">' +
        '<style id="ws-base"></style><style id="ws-imported"></style>' +
        '<style id="ws-page"></style><style id="ws-custom"></style>' +
        '<style id="ws-editor"></style></head><body></body></html>',
    );
    doc.close();

    // Same layering as export: generated rules stay unlayered and win.
    doc.getElementById('ws-base')!.textContent = `${LAYER_ORDER}\n${inLayer('ws-base', `${BASE_CSS}\n${WIDGET_CSS}`)}`;
    doc.getElementById('ws-editor')!.textContent = EDITOR_CSS;

    const script = doc.createElement('script');
    script.textContent = RUNTIME_JS;
    doc.head.appendChild(script);

    attachListeners(doc);
    readyRef.current = true;
    // Listeners read live values through refs, so they are bound exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- stylesheets ---------------------------------------------------------
  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc || !readyRef.current) return;

    const imported = doc.getElementById('ws-imported');
    if (imported) imported.textContent = inLayer('ws-template', importedCss);

    const custom = doc.getElementById('ws-custom');
    if (custom) custom.textContent = customCss ?? '';

    for (const href of externalStylesheets ?? []) {
      if (!/^https?:\/\//i.test(href)) continue;
      if (doc.querySelector(`link[href="${CSS.escape(href)}"]`)) continue;
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      doc.head.appendChild(link);
    }
  }, [importedCss, customCss, externalStylesheets]);

  // --- render on every tree change ----------------------------------------
  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc || !readyRef.current) return;

    const page = doc.getElementById('ws-page');
    // Flattened to the previewed breakpoint: see CompileOptions.flattenTo.
    if (page) page.textContent = compileCss(tree, { flattenTo: breakpoint });

    // Inline editing puts the caret in the DOM we're about to replace; skip
    // the re-render so typing isn't interrupted mid-word.
    if (doc.querySelector('[data-ws-editing="true"]')) return;

    const scroll = doc.documentElement.scrollTop;
    doc.body.innerHTML = renderNode(tree, { editor: true });
    doc.documentElement.scrollTop = scroll;

    // Elements are draggable so existing nodes can be re-ordered.
    doc.querySelectorAll('[data-ws]').forEach((el) => {
      if (el.getAttribute('data-ws') !== ROOT_ID) el.setAttribute('draggable', 'true');
    });

    applySelection(doc, selectedId);
    (frameRef.current?.contentWindow as unknown as { wsBoot?: () => void })?.wsBoot?.();
  }, [tree, selectedId, breakpoint]);

  // Selection alone must not force a full re-render.
  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (doc && readyRef.current) applySelection(doc, selectedId);
  }, [selectedId]);

  // --- interaction ---------------------------------------------------------
  function attachListeners(doc: Document) {
    const nodeIdFrom = (target: EventTarget | null): string | null => {
      const el = (target as Element | null)?.closest?.('[data-ws]');
      const id = el?.getAttribute('data-ws') ?? null;
      return id === ROOT_ID ? null : id;
    };

    doc.addEventListener('click', (event) => {
      // Links inside the canvas must not navigate the editor away.
      event.preventDefault();
      if ((event.target as Element)?.closest('[data-ws-editing="true"]')) return;
      onSelectRef.current(nodeIdFrom(event.target));
    });

    doc.addEventListener('dblclick', (event) => {
      const el = (event.target as Element | null)?.closest('[data-ws]') as HTMLElement | null;
      const id = el?.getAttribute('data-ws');
      if (!el || !id) return;

      const node = findNode(treeRef.current, id);
      if (!node || (node.type !== 'heading' && node.type !== 'text')) return;

      event.preventDefault();
      startInlineEdit(el, node.type);
    });

    const startInlineEdit = (el: HTMLElement, type: 'heading' | 'text') => {
      el.setAttribute('data-ws-editing', 'true');
      el.setAttribute('contenteditable', 'true');
      el.removeAttribute('draggable');
      el.focus();

      const finish = () => {
        el.removeAttribute('contenteditable');
        el.removeAttribute('data-ws-editing');
        const id = el.getAttribute('data-ws')!;
        onTextEditRef.current(id, type === 'heading' ? (el.textContent ?? '') : el.innerHTML);
        el.removeEventListener('blur', finish);
        el.removeEventListener('keydown', onKey);
      };

      const onKey = (event: KeyboardEvent) => {
        // Enter commits a heading; multi-line belongs in a text widget.
        if (event.key === 'Enter' && type === 'heading') {
          event.preventDefault();
          el.blur();
        }
        if (event.key === 'Escape') el.blur();
      };

      el.addEventListener('blur', finish);
      el.addEventListener('keydown', onKey);
    };

    doc.addEventListener('dragstart', (event) => {
      const id = nodeIdFrom(event.target);
      if (!id) return;
      dragState.set({ kind: 'move', nodeId: id });
      event.dataTransfer?.setData('text/plain', id);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });

    doc.addEventListener('dragover', (event) => {
      const payload = dragState.get();
      if (!payload) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = payload.kind === 'move' ? 'move' : 'copy';

      const target = resolveDropTarget(doc, event.clientX, event.clientY, payload, treeRef.current);
      dropRef.current = target;
    });

    doc.addEventListener('dragleave', () => clearDropMarkers(doc));

    doc.addEventListener('drop', (event) => {
      event.preventDefault();
      clearDropMarkers(doc);
      const target = dropRef.current;
      const payload = dragState.get();
      dropRef.current = null;
      dragState.clear();
      if (target && payload) onDropRef.current(target, payload);
    });

    doc.addEventListener('keydown', (event) => {
      // Shortcuts fired while focus is inside the iframe never reach the
      // parent window, so undo/redo has to be handled here too.
      if (event.metaKey || event.ctrlKey) {
        if (event.key.toLowerCase() === 'z') {
          event.preventDefault();
          if (event.shiftKey) onRedoRef.current();
          else onUndoRef.current();
        }
        return;
      }

      if (doc.querySelector('[data-ws-editing="true"]')) return;
      const selected = selectedRef.current;

      if ((event.key === 'Delete' || event.key === 'Backspace') && selected) {
        event.preventDefault();
        onDeleteRef.current(selected);
      }
      if (event.key === 'Escape') onSelectRef.current(null);
    });
  }

  // Callbacks reached from listeners bound once at mount.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onTextEditRef = useRef(onTextEdit);
  onTextEditRef.current = onTextEdit;
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const onUndoRef = useRef(onUndo);
  onUndoRef.current = onUndo;
  const onRedoRef = useRef(onRedo);
  onRedoRef.current = onRedo;

  return (
    <div className="flex h-full justify-center overflow-auto bg-[#2a2b33] p-4">
      <iframe
        ref={frameRef}
        title="Page canvas"
        className="h-full rounded bg-white shadow-2xl transition-[width] duration-200"
        style={{ width: FRAME_WIDTH[breakpoint], maxWidth: '100%' }}
        onDragOver={(event) => event.preventDefault()}
      />
    </div>
  );
}

function applySelection(doc: Document, selectedId: string | null) {
  doc.querySelectorAll('[data-ws-selected]').forEach((el) => el.removeAttribute('data-ws-selected'));
  if (!selectedId) return;
  const el = doc.querySelector(`[data-ws="${CSS.escape(selectedId)}"]`);
  el?.setAttribute('data-ws-selected', 'true');
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/**
 * Works out where a drop would land, and marks the DOM to show it.
 *
 * Two cases: over a container, the drop goes *inside* between its children;
 * over a leaf, it becomes a sibling before or after, depending on which half
 * of the element the cursor is in. Either way we walk up until we find an
 * ancestor that will actually accept the dragged type, so the indicator can
 * never promise a drop the tree would reject.
 */
function resolveDropTarget(
  doc: Document,
  x: number,
  y: number,
  payload: ReturnType<typeof dragState.get>,
  tree: BuilderNode,
): DropTarget | null {
  doc.querySelectorAll('[data-ws-drop]').forEach((el) => el.removeAttribute('data-ws-drop'));
  if (!payload) return null;

  const draggedType =
    payload.kind === 'new'
      ? payload.widget
      : payload.kind === 'paste'
        ? payload.node.type
        : (findNode(tree, payload.nodeId)?.type ?? null);
  if (!draggedType) return null;

  const accepts = (id: string): boolean => {
    const node = findNode(tree, id);
    if (!node) return false;
    // Dropping a node into its own subtree would orphan that branch.
    if (payload.kind === 'move' && (id === payload.nodeId || findNode(node, payload.nodeId))) return false;
    return canAcceptChild(node, draggedType);
  };

  const hit = doc.elementFromPoint(x, y)?.closest('[data-ws]') as HTMLElement | null;
  const rootEl = doc.querySelector(`[data-ws="${ROOT_ID}"]`) as HTMLElement | null;
  const element = hit ?? rootEl ?? (doc.body.firstElementChild as HTMLElement | null);
  if (!element) return accepts(ROOT_ID) ? { parentId: ROOT_ID, index: tree.children.length } : null;

  let candidate: HTMLElement | null = element;
  while (candidate) {
    const id = candidate.getAttribute('data-ws')!;
    const isContainerEl = candidate.hasAttribute('data-ws-type')
      ? accepts(id)
      : id === ROOT_ID && accepts(id);

    if (isContainerEl) {
      const children = Array.from(candidate.children).filter((child) =>
        child.hasAttribute('data-ws'),
      ) as HTMLElement[];

      if (children.length === 0) {
        candidate.setAttribute('data-ws-drop', 'inside');
        return { parentId: id, index: 0 };
      }

      const horizontal = isHorizontal(doc, candidate);
      let index = children.length;
      for (let i = 0; i < children.length; i += 1) {
        const rect = children[i].getBoundingClientRect();
        const midpoint = horizontal ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
        if ((horizontal ? x : y) < midpoint) {
          index = i;
          break;
        }
      }

      const marker = children[Math.min(index, children.length - 1)];
      const after = index >= children.length;
      marker.setAttribute(
        'data-ws-drop',
        horizontal ? (after ? 'after-x' : 'before-x') : after ? 'after' : 'before',
      );

      return { parentId: id, index };
    }

    candidate = candidate.parentElement?.closest('[data-ws]') as HTMLElement | null;
  }

  return accepts(ROOT_ID) ? { parentId: ROOT_ID, index: tree.children.length } : null;
}

function isHorizontal(doc: Document, el: HTMLElement): boolean {
  const style = doc.defaultView?.getComputedStyle(el);
  if (!style) return false;
  if (style.display === 'flex' || style.display === 'inline-flex') {
    return style.flexDirection.startsWith('row');
  }
  return false;
}
