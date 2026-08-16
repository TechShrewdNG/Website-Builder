/**
 * The JSON stored on `Project.theme`.
 *
 * Kept in one place because it is read by the editor, the published route and
 * the exporter, and an untyped `as any` in three files is how these drift.
 */

import type { StyleMap } from './types';

export interface ProjectTheme {
  /** Absolute stylesheet URLs carried over from an import. */
  externalStylesheets?: string[];
  /** Overrides for `:root` custom properties found in the template. */
  tokens?: Record<string, string>;
  /** Edits to the template's own rules, keyed by selector. */
  ruleOverrides?: Record<string, StyleMap>;
}

export function readTheme(value: unknown): ProjectTheme {
  return (value ?? {}) as ProjectTheme;
}
