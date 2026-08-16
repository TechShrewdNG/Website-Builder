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
  STATES,
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

  // States are not breakpoint-scoped, so they ride along with desktop and
  // therefore apply at every width.
  for (const state of STATES) {
    const body = declarations(node.states?.[state] ?? {});
    if (body) acc.desktop.push(`[data-ws="${node.id}"]:${state} {\n${body}\n}`);
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

/**
 * Wraps a stylesheet in a cascade layer, tolerating empty input.
 *
 * `@import` is only valid before any style rule, so an @import left inside a
 * layer block is dropped by every browser — silently taking the template's
 * webfonts with it. They are hoisted above the block instead.
 */
export function inLayer(name: string, css: string | null | undefined): string {
  const body = (css ?? '').trim();
  if (!body) return '';

  const imports: string[] = [];
  const rest = body.replace(/@import\s+[^;]+;/g, (match) => {
    imports.push(match.trim());
    return '';
  });

  const block = rest.trim() ? `@layer ${name} {\n${rest.trim()}\n}` : '';
  return [...imports, block].filter(Boolean).join('\n');
}

/**
 * Collects `--custom-property` declarations from a `:root` block.
 *
 * Templates increasingly define their palette this way, and surfacing those
 * makes a whole imported colour scheme editable from one place instead of
 * hunting through the stylesheet.
 */
export function extractTokens(css: string | null | undefined): Record<string, string> {
  if (!css) return {};
  const tokens: Record<string, string> = {};

  for (const block of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
    for (const declaration of block[1].split(';')) {
      const index = declaration.indexOf(':');
      if (index < 0) continue;
      const name = declaration.slice(0, index).trim();
      const value = declaration.slice(index + 1).trim();
      if (name.startsWith('--') && value) tokens[name] = value;
    }
  }
  return tokens;
}

/** Emits token overrides, which win because they come after the template. */
export function compileTokens(tokens: Record<string, string>): string {
  const body = Object.entries(tokens)
    .filter(([name, value]) => name.startsWith('--') && value !== '')
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  return body ? `:root {\n${body}\n}` : '';
}

/**
 * Edits to the template's own rules.
 *
 * Kept as a separate managed block rather than rewritten into the imported
 * stylesheet: parsing and re-serialising someone's CSS reformats every line
 * and risks dropping anything the parser doesn't understand. Emitting the
 * edits afterwards is non-destructive and trivially reversible — deleting an
 * override restores the original rule exactly.
 *
 * Unlayered, so these beat the template. Per-element styles are emitted after
 * them and therefore still win, which keeps "select an element and change it"
 * the most specific action available.
 */
export function compileRuleOverrides(overrides: Record<string, StyleMap> | null | undefined): string {
  if (!overrides) return '';

  return Object.entries(overrides)
    .filter(([selector, styles]) => selector.trim() && Object.keys(styles ?? {}).length > 0)
    .map(([selector, styles]) => {
      const body = declarations(styles);
      return body ? `${selector} {\n${body}\n}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Splits a stylesheet into top-level rules for the rule editor.
 *
 * A deliberately small scanner rather than a CSS parser: it tracks brace depth
 * and string state, which is enough to find selectors and their bodies, and it
 * never has to reproduce the source since edits are stored separately.
 * At-rules are reported so the panel can show them as read-only context.
 */
export interface ParsedRule {
  selector: string;
  declarations: StyleMap;
  /** e.g. "@media (max-width: 600px)" when the rule is nested in one. */
  context?: string;
}

export function parseRules(css: string | null | undefined): ParsedRule[] {
  if (!css) return [];

  const rules: ParsedRule[] = [];
  const stack: string[] = [];
  let buffer = '';
  let depth = 0;
  let quote: string | null = null;

  const flushBlock = (selector: string, body: string) => {
    const trimmed = selector.trim();
    if (!trimmed || trimmed.startsWith('@')) return;

    const map: StyleMap = {};
    for (const part of body.split(';')) {
      const index = part.indexOf(':');
      if (index < 0) continue;
      const prop = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      if (prop && value) map[prop] = value;
    }
    if (Object.keys(map).length) {
      rules.push({ selector: trimmed, declarations: map, context: stack[stack.length - 1] });
    }
  };

  for (let i = 0; i < css.length; i += 1) {
    const char = css[i];

    if (quote) {
      buffer += char;
      if (char === quote && css[i - 1] !== '\\') quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      buffer += char;
      continue;
    }

    if (char === '{') {
      const head = buffer.trim();
      buffer = '';
      depth += 1;

      // An at-rule with a block (@media, @supports) wraps rules of its own.
      if (head.startsWith('@')) {
        stack.push(head);
        continue;
      }

      // Read this block's body, honouring nesting — and quotes, since a
      // braced string like `content: "}"` would otherwise desync the scan for
      // the rest of the file.
      let body = '';
      let inner = 1;
      let bodyQuote: string | null = null;
      i += 1;
      for (; i < css.length && inner > 0; i += 1) {
        const current = css[i];

        if (bodyQuote) {
          if (current === bodyQuote && css[i - 1] !== '\\') bodyQuote = null;
        } else if (current === '"' || current === "'") {
          bodyQuote = current;
        } else if (current === '{') {
          inner += 1;
        } else if (current === '}') {
          inner -= 1;
          if (inner === 0) break;
        }

        body += current;
      }
      depth -= 1;
      flushBlock(head, body);
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (stack.length && depth < stack.length) stack.pop();
      buffer = '';
      continue;
    }

    buffer += char;
  }

  return rules;
}
