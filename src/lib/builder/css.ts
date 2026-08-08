/**
 * Style compilation: BuilderNode tree -> CSS text.
 *
 * Every node is addressed by `[data-ws="<id>"]`, an attribute the renderer
 * always emits, which keeps generated CSS from colliding with class names in
 * an imported stylesheet.
 *
 * Specificity alone is not enough to make an edit stick: `[data-ws="x"]` is
 * (0,1,0) and loses to a perfectly ordinary template rule like `.hero h1`
 * (0,1,1). So the cascade is arranged with layers instead. Base and template
 * CSS go into layers; generated rules stay unlayered, and unlayered styles
 * beat layered ones no matter how specific the layered selector is. That way
 * clicking a control always wins, without scattering `!important` everywhere.
 */

import {
  BREAKPOINT_MAX_WIDTH,
  BREAKPOINTS,
  type BuilderNode,
  type Breakpoint,
  type StyleMap,
} from './types';

function declarations(styles: StyleMap, indent = '  '): string {
  return Object.entries(styles)
    .filter(([, value]) => value !== '' && value != null)
    .map(([prop, value]) => `${indent}${prop}: ${value};`)
    .join('\n');
}

/**
 * Structural CSS a widget needs to work, independent of user styling.
 * Kept separate from `node.styles` so the user can never delete the rules that
 * make a columns row behave like a row.
 */
function structuralStyles(node: BuilderNode): Partial<Record<Breakpoint, StyleMap>> {
  switch (node.type) {
    case 'columns': {
      const gap = String(node.props.gap ?? '24px');
      const stackOn = String(node.props.stackOn ?? 'mobile');
      const out: Partial<Record<Breakpoint, StyleMap>> = {
        desktop: { display: 'flex', 'flex-wrap': 'wrap', gap, 'align-items': 'stretch' },
      };
      if (stackOn === 'tablet' || stackOn === 'mobile') {
        out[stackOn] = { 'flex-direction': 'column' };
      }
      return out;
    }
    case 'column': {
      const width = String(node.props.width ?? '').trim();
      return {
        desktop: width
          ? { 'flex': `0 0 ${width}`, 'max-width': width, 'min-width': '0' }
          : { 'flex': '1 1 0%', 'min-width': '0' },
      };
    }
    case 'spacer':
      return { desktop: { height: String(node.props.height ?? '48px'), 'flex-shrink': '0' } };
    case 'divider':
      return { desktop: { width: '100%' } };
    default:
      return {};
  }
}

interface Collected {
  desktop: string[];
  tablet: string[];
  mobile: string[];
}

function collect(node: BuilderNode, acc: Collected): void {
  const structural = structuralStyles(node);

  for (const bp of BREAKPOINTS) {
    const merged: StyleMap = { ...(structural[bp] ?? {}), ...(node.styles?.[bp] ?? {}) };
    const body = declarations(merged);
    if (body) acc[bp].push(`[data-ws="${node.id}"] {\n${body}\n}`);
  }

  // A boxed section centres its children without needing a wrapper element.
  if (node.type === 'section' && node.props.contentWidth === 'boxed') {
    const maxWidth = String(node.props.maxWidth || '1140px');
    acc.desktop.push(
      `[data-ws="${node.id}"] > * {\n  max-width: ${maxWidth};\n  margin-left: auto;\n  margin-right: auto;\n  width: 100%;\n}`,
    );
  }

  for (const child of node.children) collect(child, acc);
}

/** Base rules every generated page relies on. */
export const BASE_CSS = `*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
img { max-width: 100%; }
[data-ws] { min-height: 0; }
[data-ws-empty="true"] { min-height: 60px; }
`;

export interface CompileOptions {
  /**
   * Editor preview only.
   *
   * The canvas iframe is narrower than the real viewport — the two side
   * panels eat several hundred pixels — so `@media` queries would fire based
   * on the iframe's width rather than on the breakpoint being previewed, and
   * a laptop-sized editor would show mobile styles under "desktop". Setting
   * this emits the cascade for the chosen breakpoint with no media queries at
   * all, so what you preview is what that breakpoint actually gets.
   *
   * Never set for export or publish, where real media queries are the point.
   */
  flattenTo?: Breakpoint;
}

export function compileCss(root: BuilderNode, options: CompileOptions = {}): string {
  const acc: Collected = { desktop: [], tablet: [], mobile: [] };
  collect(root, acc);

  if (options.flattenTo) {
    // Narrower breakpoints inherit from wider ones, so include every block up
    // to the previewed one, in cascade order.
    const upTo: Breakpoint[] =
      options.flattenTo === 'desktop'
        ? ['desktop']
        : options.flattenTo === 'tablet'
          ? ['desktop', 'tablet']
          : ['desktop', 'tablet', 'mobile'];

    return upTo
      .flatMap((bp) => acc[bp])
      .join('\n\n');
  }

  const parts: string[] = [];
  if (acc.desktop.length) parts.push(acc.desktop.join('\n\n'));
  for (const bp of ['tablet', 'mobile'] as const) {
    if (!acc[bp].length) continue;
    const inner = acc[bp].map((rule) => rule.replace(/^/gm, '  ')).join('\n\n');
    parts.push(`@media (max-width: ${BREAKPOINT_MAX_WIDTH[bp]}px) {\n${inner}\n}`);
  }
  return parts.join('\n\n');
}

/**
 * Declares the layer order. Must appear before any layered rule, so it is
 * emitted at the very top of every stylesheet the builder produces.
 *
 * Later layers win over earlier ones, and unlayered rules — the generated
 * per-node styles — win over all of them.
 */
export const LAYER_ORDER = '@layer ws-base, ws-template;';

/** Wraps a stylesheet in a cascade layer, tolerating empty input. */
export function inLayer(name: string, css: string | null | undefined): string {
  const body = (css ?? '').trim();
  if (!body) return '';
  return `@layer ${name} {\n${body}\n}`;
}
