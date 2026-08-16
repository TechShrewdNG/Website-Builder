/**
 * Immutable tree operations.
 *
 * Every function returns a new root rather than mutating in place, which is
 * what makes undo/redo in the editor a matter of keeping old roots around.
 */

import { createNode, newId } from './widgets';
import {
  canAcceptChild,
  emptyStyles,
  ROOT_ID,
  type BuilderNode,
  type Breakpoint,
  type StyleMap,
  type StyleState,
} from './types';

export function createRoot(children: BuilderNode[] = []): BuilderNode {
  return { id: ROOT_ID, type: 'container', props: { tag: 'div' }, styles: emptyStyles(), children };
}

export function findNode(root: BuilderNode, id: string): BuilderNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findParent(root: BuilderNode, id: string): BuilderNode | null {
  for (const child of root.children) {
    if (child.id === id) return root;
    const found = findParent(child, id);
    if (found) return found;
  }
  return null;
}

/** Ancestor chain from the root down to (and excluding) `id`. */
export function pathTo(root: BuilderNode, id: string): BuilderNode[] {
  const path: BuilderNode[] = [];
  function walk(node: BuilderNode): boolean {
    if (node.id === id) return true;
    for (const child of node.children) {
      path.push(node);
      if (walk(child)) return true;
      path.pop();
    }
    return false;
  }
  return walk(root) ? path : [];
}

function mapTree(node: BuilderNode, fn: (n: BuilderNode) => BuilderNode): BuilderNode {
  const mapped = fn(node);
  return { ...mapped, children: mapped.children.map((child) => mapTree(child, fn)) };
}

export function updateNode(
  root: BuilderNode,
  id: string,
  update: (node: BuilderNode) => BuilderNode,
): BuilderNode {
  return mapTree(root, (node) => (node.id === id ? update(node) : node));
}

export function setProps(root: BuilderNode, id: string, props: Record<string, unknown>): BuilderNode {
  return updateNode(root, id, (node) => {
    const next: BuilderNode = { ...node, props: { ...node.props, ...props } };
    // Changing the column count has to add or drop actual column children.
    if (node.type === 'columns' && props.count != null) {
      const count = Math.max(1, Math.min(6, Number(props.count)));
      const children = node.children.slice(0, count);
      while (children.length < count) children.push(createNode('column'));
      next.children = children;
      next.props.count = count;
    }
    return next;
  });
}

export function setStyle(
  root: BuilderNode,
  id: string,
  breakpoint: Breakpoint,
  patch: StyleMap,
): BuilderNode {
  return updateNode(root, id, (node) => {
    const merged: StyleMap = { ...node.styles[breakpoint], ...patch };
    // An empty value means "unset", so the property drops out of the cascade
    // and any inherited or imported rule applies again.
    for (const [key, value] of Object.entries(patch)) {
      if (value === '' || value == null) delete merged[key];
    }
    return { ...node, styles: { ...node.styles, [breakpoint]: merged } };
  });
}

/** Same semantics as setStyle, for `:hover` / `:focus` declarations. */
export function setStateStyle(
  root: BuilderNode,
  id: string,
  state: StyleState,
  patch: StyleMap,
): BuilderNode {
  return updateNode(root, id, (node) => {
    const merged: StyleMap = { ...(node.states?.[state] ?? {}), ...patch };
    for (const [key, value] of Object.entries(patch)) {
      if (value === '' || value == null) delete merged[key];
    }

    const states = { ...node.states, [state]: merged };
    // Drop the key entirely when empty, so trees stay comparable and clean.
    if (Object.keys(merged).length === 0) delete states[state];

    return { ...node, states: Object.keys(states).length ? states : undefined };
  });
}

export function removeNode(root: BuilderNode, id: string): BuilderNode {
  if (id === ROOT_ID) return root;
  return mapTree(root, (node) => ({
    ...node,
    children: node.children.filter((child) => child.id !== id),
  }));
}

/** Fresh ids throughout, so a duplicate is genuinely independent. */
export function cloneWithNewIds(node: BuilderNode): BuilderNode {
  return {
    ...JSON.parse(JSON.stringify(node)),
    id: newId(),
    children: node.children.map(cloneWithNewIds),
  };
}

export function duplicateNode(root: BuilderNode, id: string): BuilderNode {
  const parent = findParent(root, id);
  if (!parent) return root;
  const index = parent.children.findIndex((child) => child.id === id);
  if (index < 0) return root;
  const copy = cloneWithNewIds(parent.children[index]);
  return updateNode(root, parent.id, (node) => ({
    ...node,
    children: [...node.children.slice(0, index + 1), copy, ...node.children.slice(index + 1)],
  }));
}

export function insertNode(
  root: BuilderNode,
  parentId: string,
  node: BuilderNode,
  index: number,
): BuilderNode {
  const parent = findNode(root, parentId);
  if (!parent || !canAcceptChild(parent, node.type)) return root;
  return updateNode(root, parentId, (current) => {
    const children = [...current.children];
    children.splice(Math.max(0, Math.min(index, children.length)), 0, node);
    return { ...current, children };
  });
}

export function isDescendant(root: BuilderNode, ancestorId: string, maybeChildId: string): boolean {
  const ancestor = findNode(root, ancestorId);
  if (!ancestor) return false;
  return findNode(ancestor, maybeChildId) != null && ancestorId !== maybeChildId;
}

/**
 * Move an existing node to a new parent and index.
 *
 * `index` is interpreted against the target parent's children *before* the
 * node is detached, which is what the drop indicator in the canvas shows.
 */
export function moveNode(
  root: BuilderNode,
  nodeId: string,
  targetParentId: string,
  index: number,
): BuilderNode {
  if (nodeId === ROOT_ID || nodeId === targetParentId) return root;
  // Dropping a node inside itself would detach that whole branch from the tree.
  if (isDescendant(root, nodeId, targetParentId)) return root;

  const node = findNode(root, nodeId);
  const target = findNode(root, targetParentId);
  if (!node || !target || !canAcceptChild(target, node.type)) return root;

  const currentParent = findParent(root, nodeId);
  let adjusted = index;
  if (currentParent?.id === targetParentId) {
    const from = currentParent.children.findIndex((child) => child.id === nodeId);
    if (from > -1 && from < index) adjusted -= 1;
  }

  const detached = removeNode(root, nodeId);
  return insertNode(detached, targetParentId, node, adjusted);
}

/** Depth-first list of ids, in document order. Used by the layer tree. */
export function flatten(root: BuilderNode): BuilderNode[] {
  return [root, ...root.children.flatMap(flatten)];
}

export function countNodes(root: BuilderNode): number {
  return flatten(root).length;
}
