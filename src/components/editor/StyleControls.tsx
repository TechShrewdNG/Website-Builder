'use client';

import { useState } from 'react';

import type { BuilderNode, Breakpoint, StyleMap } from '@/lib/builder/types';

interface Props {
  node: BuilderNode;
  breakpoint: Breakpoint;
  onChange: (patch: StyleMap) => void;
}

type FieldKind = 'text' | 'color' | 'select' | 'box' | 'number';

interface Field {
  /** CSS property, or the shared prefix for a `box` field. */
  prop: string;
  label: string;
  kind: FieldKind;
  options?: string[];
  placeholder?: string;
}

interface Group {
  title: string;
  fields: Field[];
}

const GROUPS: Group[] = [
  {
    title: 'Layout',
    fields: [
      { prop: 'display', label: 'Display', kind: 'select', options: ['', 'block', 'flex', 'inline-block', 'inline-flex', 'grid', 'none'] },
      { prop: 'flex-direction', label: 'Direction', kind: 'select', options: ['', 'row', 'column', 'row-reverse', 'column-reverse'] },
      { prop: 'justify-content', label: 'Justify', kind: 'select', options: ['', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'] },
      { prop: 'align-items', label: 'Align', kind: 'select', options: ['', 'stretch', 'flex-start', 'center', 'flex-end', 'baseline'] },
      { prop: 'gap', label: 'Gap', kind: 'text', placeholder: '16px' },
      { prop: 'width', label: 'Width', kind: 'text', placeholder: 'auto' },
      { prop: 'height', label: 'Height', kind: 'text', placeholder: 'auto' },
      { prop: 'max-width', label: 'Max width', kind: 'text', placeholder: 'none' },
      { prop: 'margin', label: 'Margin', kind: 'box' },
      { prop: 'padding', label: 'Padding', kind: 'box' },
    ],
  },
  {
    title: 'Typography',
    fields: [
      { prop: 'font-family', label: 'Font', kind: 'text', placeholder: 'inherit' },
      { prop: 'font-size', label: 'Size', kind: 'text', placeholder: '16px' },
      { prop: 'font-weight', label: 'Weight', kind: 'select', options: ['', '300', '400', '500', '600', '700', '800', '900'] },
      { prop: 'line-height', label: 'Line height', kind: 'text', placeholder: '1.5' },
      { prop: 'letter-spacing', label: 'Letter spacing', kind: 'text', placeholder: '0' },
      { prop: 'text-align', label: 'Text align', kind: 'select', options: ['', 'left', 'center', 'right', 'justify'] },
      { prop: 'text-transform', label: 'Transform', kind: 'select', options: ['', 'none', 'uppercase', 'lowercase', 'capitalize'] },
      { prop: 'color', label: 'Colour', kind: 'color' },
    ],
  },
  {
    title: 'Background',
    fields: [
      { prop: 'background-color', label: 'Colour', kind: 'color' },
      { prop: 'background-image', label: 'Image', kind: 'text', placeholder: 'url(...)' },
      { prop: 'background-size', label: 'Size', kind: 'select', options: ['', 'cover', 'contain', 'auto'] },
      { prop: 'background-position', label: 'Position', kind: 'text', placeholder: 'center' },
      { prop: 'background-repeat', label: 'Repeat', kind: 'select', options: ['', 'no-repeat', 'repeat', 'repeat-x', 'repeat-y'] },
    ],
  },
  {
    title: 'Border & effects',
    fields: [
      { prop: 'border-width', label: 'Border width', kind: 'text', placeholder: '0' },
      { prop: 'border-style', label: 'Border style', kind: 'select', options: ['', 'solid', 'dashed', 'dotted', 'none'] },
      { prop: 'border-color', label: 'Border colour', kind: 'color' },
      { prop: 'border-radius', label: 'Radius', kind: 'text', placeholder: '0' },
      { prop: 'box-shadow', label: 'Shadow', kind: 'text', placeholder: '0 2px 8px rgba(0,0,0,.15)' },
      { prop: 'opacity', label: 'Opacity', kind: 'text', placeholder: '1' },
    ],
  },
];

const BOX_SIDES = ['top', 'right', 'bottom', 'left'] as const;

export default function StyleControls({ node, breakpoint, onChange }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({ Layout: true, Typography: true });

  const current = node.styles[breakpoint] ?? {};
  // Desktop values cascade down, so tablet/mobile show them as placeholders —
  // an empty field there means "inherit", not "no value".
  const inherited: StyleMap = breakpoint === 'desktop' ? {} : node.styles.desktop ?? {};

  return (
    <div>
      {breakpoint !== 'desktop' && (
        <p className="mb-3 rounded border border-edge bg-panelAlt px-2 py-1.5 text-[11px] text-neutral-400">
          Editing <strong className="text-neutral-200">{breakpoint}</strong>. Blank fields inherit the
          desktop value shown in grey.
        </p>
      )}

      {GROUPS.map((group) => (
        <section key={group.title} className="mb-2 border-b border-edge pb-2">
          <button
            type="button"
            className="flex w-full items-center justify-between py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400 hover:text-white"
            onClick={() => setOpen((prev) => ({ ...prev, [group.title]: !prev[group.title] }))}
          >
            {group.title}
            <span aria-hidden="true">{open[group.title] ? '−' : '+'}</span>
          </button>

          {open[group.title] && (
            <div className="grid grid-cols-2 gap-2 pb-2">
              {group.fields.map((field) =>
                field.kind === 'box' ? (
                  <BoxField
                    key={field.prop}
                    field={field}
                    values={current}
                    inherited={inherited}
                    onChange={onChange}
                  />
                ) : (
                  <StyleField
                    key={field.prop}
                    field={field}
                    value={current[field.prop] ?? ''}
                    inheritedValue={inherited[field.prop] ?? ''}
                    onChange={(value) => onChange({ [field.prop]: value })}
                  />
                ),
              )}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function StyleField({
  field,
  value,
  inheritedValue,
  onChange,
}: {
  field: Field;
  value: string;
  inheritedValue: string;
  onChange: (value: string) => void;
}) {
  if (field.kind === 'select') {
    return (
      <label className="block">
        <span className="ws-label">{field.label}</span>
        <select className="ws-field" value={value} onChange={(event) => onChange(event.target.value)}>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option === '' ? (inheritedValue || 'default') : option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.kind === 'color') {
    return (
      <label className="block">
        <span className="ws-label">{field.label}</span>
        <div className="flex gap-1">
          <input
            type="color"
            aria-label={`${field.label} colour picker`}
            className="h-[34px] w-9 shrink-0 cursor-pointer rounded border border-edge bg-panelAlt"
            value={toHex(value || inheritedValue)}
            onChange={(event) => onChange(event.target.value)}
          />
          <input
            className="ws-field"
            value={value}
            placeholder={inheritedValue || 'inherit'}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      </label>
    );
  }

  return (
    <label className="block">
      <span className="ws-label">{field.label}</span>
      <input
        className="ws-field"
        value={value}
        placeholder={inheritedValue || field.placeholder || ''}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

/** Four-sided margin/padding, written as longhand so sides stay independent. */
function BoxField({
  field,
  values,
  inherited,
  onChange,
}: {
  field: Field;
  values: StyleMap;
  inherited: StyleMap;
  onChange: (patch: StyleMap) => void;
}) {
  return (
    <div className="col-span-2">
      <span className="ws-label">{field.label}</span>
      <div className="grid grid-cols-4 gap-1">
        {BOX_SIDES.map((side) => {
          const prop = `${field.prop}-${side}`;
          return (
            <input
              key={side}
              className="ws-field text-center"
              aria-label={`${field.label} ${side}`}
              title={side}
              value={values[prop] ?? ''}
              placeholder={inherited[prop] ?? side.charAt(0).toUpperCase()}
              onChange={(event) => onChange({ [prop]: event.target.value })}
            />
          );
        })}
      </div>
    </div>
  );
}

/** The native colour input only accepts #rrggbb. */
function toHex(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split('')
      .map((char) => char + char)
      .join('')}`;
  }
  return '#000000';
}
