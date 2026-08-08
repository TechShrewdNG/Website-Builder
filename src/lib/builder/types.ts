/**
 * The document model.
 *
 * A page is a tree of BuilderNodes. This module is the single source of truth
 * for that shape: the editor mutates it, the renderer turns it into HTML, the
 * importer produces it, and the exporter serialises it. Nothing else defines
 * page structure.
 *
 * Deliberately plain data — no classes, no functions on nodes — so a tree can
 * round-trip through JSON.stringify into Postgres and back without loss.
 */

export const BREAKPOINTS = ['desktop', 'tablet', 'mobile'] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];

/** Widths at which the tablet/mobile style blocks take over. */
export const BREAKPOINT_MAX_WIDTH: Record<Exclude<Breakpoint, 'desktop'>, number> = {
  tablet: 1024,
  mobile: 767,
};

/** CSS declarations, keyed by kebab-case property name. */
export type StyleMap = Record<string, string>;

export type ResponsiveStyles = Record<Breakpoint, StyleMap>;

export type WidgetType =
  // layout
  | 'section'
  | 'container'
  | 'columns'
  | 'column'
  // content
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'icon'
  | 'divider'
  | 'spacer'
  | 'link'
  // dynamic
  | 'slider'
  | 'tabs'
  | 'accordion'
  | 'counter'
  // escape hatch, also used by the importer for markup it will not model
  | 'html';

export interface BuilderNode {
  id: string;
  type: WidgetType;
  /** Widget-specific content, e.g. { text, level } for a heading. */
  props: Record<string, unknown>;
  styles: ResponsiveStyles;
  /**
   * Class names preserved from imported HTML. The original stylesheet is kept
   * verbatim on the project, so keeping these means an imported page still
   * looks like itself before the user touches anything.
   */
  classes?: string[];
  /** Other preserved attributes (id, data-*, aria-*, role...). */
  attrs?: Record<string, string>;
  children: BuilderNode[];
}

export interface PageDocument {
  /** Bumped when the tree shape changes in a way that needs migration. */
  version: 1;
  root: BuilderNode;
}

export function emptyStyles(): ResponsiveStyles {
  return { desktop: {}, tablet: {}, mobile: {} };
}

/** Nodes that accept dropped children in the canvas. */
export const CONTAINER_TYPES: ReadonlySet<WidgetType> = new Set<WidgetType>([
  'section',
  'container',
  'columns',
  'column',
  'link',
]);

export function isContainer(node: BuilderNode): boolean {
  return CONTAINER_TYPES.has(node.type);
}

export const ROOT_ID = 'root';

/**
 * Structural rules for drops. Columns are the strict case: a `columns` row
 * holds only `column` children, and a `column` exists nowhere else.
 */
export function canAcceptChild(parent: BuilderNode, childType: WidgetType): boolean {
  if (!CONTAINER_TYPES.has(parent.type)) return false;
  if (parent.type === 'columns') return childType === 'column';
  if (childType === 'column') return false;
  // Sections are top-level page bands. Nesting them buys no layout the
  // container widget can't express, and it muddles the outline.
  if (childType === 'section') return parent.id === ROOT_ID;
  return true;
}
