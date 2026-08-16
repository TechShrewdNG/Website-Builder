'use client';

import { useMemo, useState } from 'react';

import Icon from '@/components/Icon';
import { parseRules, type ParsedRule } from '@/lib/builder/css';
import type { StyleMap } from '@/lib/builder/types';

interface Props {
  /** The template's own stylesheet. */
  importedCss: string | null;
  /** Edits already made, keyed by selector. */
  overrides: Record<string, StyleMap>;
  /** Tests a selector against the selected element, inside the canvas. */
  matches: (selector: string) => boolean;
  onChange: (selector: string, declarations: StyleMap) => void;
}

/**
 * Edits the template's own CSS rules.
 *
 * The style panel writes `[data-ws="id"]` rules that affect exactly one
 * element. That is wrong for a template: changing `.btn` should change every
 * button, and hunting for the rule in a textarea is not editing. This lists
 * the rules that actually match the selected element and makes each editable.
 *
 * Edits are stored as overrides rather than rewritten into the imported
 * stylesheet — see `compileRuleOverrides` for why — so the original is never
 * reformatted and clearing an edit restores it exactly.
 */
export default function CssRules({ importedCss, overrides, matches, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [newProp, setNewProp] = useState('');
  const [newValue, setNewValue] = useState('');
  const [openSelector, setOpenSelector] = useState<string | null>(null);

  const rules = useMemo(() => parseRules(importedCss), [importedCss]);

  // A rule can be written `.a, .b { … }`; it applies if any part matches.
  const matching = useMemo(() => {
    const found: ParsedRule[] = [];
    for (const rule of rules) {
      const applies = rule.selector.split(',').some((part) => {
        const trimmed = part.trim();
        if (!trimmed) return false;
        try {
          return matches(trimmed);
        } catch {
          // Selectors the browser rejects (vendor hacks) simply don't apply.
          return false;
        }
      });
      if (applies) found.push(rule);
    }
    return found;
  }, [rules, matches]);

  // Selectors edited earlier should stay visible even if the element no
  // longer matches them, or the edit becomes unreachable.
  const editedSelectors = Object.keys(overrides).filter(
    (selector) => !matching.some((rule) => rule.selector === selector),
  );

  if (!importedCss) {
    return (
      <p className="text-[11px] leading-relaxed text-faint">
        This site has no imported stylesheet. Class-level rules appear here when a template is
        imported.
      </p>
    );
  }

  if (matching.length === 0 && editedSelectors.length === 0) {
    return (
      <p className="text-[11px] leading-relaxed text-faint">
        No stylesheet rules match this element. Its appearance comes from the element&apos;s own
        styles above.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="mb-1 text-[11px] leading-relaxed text-faint">
        Editing these changes every element the rule matches, not just this one.
      </p>

      {[...matching.map((rule) => rule.selector), ...editedSelectors]
        // A selector can appear twice (base rule plus a media query).
        .filter((selector, index, all) => all.indexOf(selector) === index)
        .map((selector) => {
          const base = matching.filter((rule) => rule.selector === selector);
          const override = overrides[selector] ?? {};
          const open = openSelector === selector;

          // What the rule currently resolves to: template first, edits on top.
          const effective: StyleMap = {};
          for (const rule of base) Object.assign(effective, rule.declarations);
          Object.assign(effective, override);

          return (
            <div key={selector} className="overflow-hidden rounded-lg border border-edge bg-panelRaised">
              <button
                type="button"
                onClick={() => setOpenSelector(open ? null : selector)}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
              >
                <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-neutral-200">
                  {selector}
                </code>
                {Object.keys(override).length > 0 && (
                  <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[9.5px] font-medium text-accent">
                    edited
                  </span>
                )}
                <span className="shrink-0 text-[10px] tabular-nums text-faint">
                  {Object.keys(effective).length}
                </span>
              </button>

              {open && (
                <div className="border-t border-edge p-2">
                  {base.some((rule) => rule.context) && (
                    <p className="mb-2 font-mono text-[10px] text-faint">
                      also in {base.find((rule) => rule.context)?.context}
                    </p>
                  )}

                  <div className="flex flex-col gap-1.5">
                    {Object.entries(effective).map(([prop, value]) => (
                      <label key={prop} className="flex items-center gap-1.5">
                        <code className="w-[92px] shrink-0 truncate font-mono text-[10px] text-muted" title={prop}>
                          {prop}
                        </code>
                        <input
                          className="ws-field py-1 font-mono text-[11px]"
                          value={value}
                          onChange={(event) =>
                            onChange(selector, { ...override, [prop]: event.target.value })
                          }
                        />
                        {override[prop] !== undefined && (
                          <button
                            type="button"
                            title="Revert to the template's value"
                            aria-label={`Revert ${prop}`}
                            className="shrink-0 text-[10px] text-faint transition-colors hover:text-white"
                            onClick={() => {
                              const next = { ...override };
                              delete next[prop];
                              onChange(selector, next);
                            }}
                          >
                            ↺
                          </button>
                        )}
                      </label>
                    ))}
                  </div>

                  {adding && openSelector === selector ? (
                    <div className="mt-2 flex items-center gap-1.5">
                      <input
                        className="ws-field w-[92px] shrink-0 py-1 font-mono text-[11px]"
                        placeholder="property"
                        value={newProp}
                        onChange={(event) => setNewProp(event.target.value)}
                      />
                      <input
                        className="ws-field py-1 font-mono text-[11px]"
                        placeholder="value"
                        value={newValue}
                        onChange={(event) => setNewValue(event.target.value)}
                      />
                      <button
                        type="button"
                        className="shrink-0 text-[11px] text-accent"
                        onClick={() => {
                          if (newProp.trim() && newValue.trim()) {
                            onChange(selector, { ...override, [newProp.trim()]: newValue.trim() });
                          }
                          setNewProp('');
                          setNewValue('');
                          setAdding(false);
                        }}
                      >
                        Add
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="ws-btn mt-2 w-full py-1 text-[11px]"
                      onClick={() => setAdding(true)}
                    >
                      <Icon name="plus" size={13} />
                      Add a property
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
