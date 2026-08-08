'use client';

import { useRef, useState } from 'react';

import { WIDGETS, type Control } from '@/lib/builder/widgets';
import type { BuilderNode, Breakpoint, StyleMap } from '@/lib/builder/types';
import StyleControls from './StyleControls';

interface Props {
  node: BuilderNode | null;
  projectId: string;
  breakpoint: Breakpoint;
  onPropsChange: (patch: Record<string, unknown>) => void;
  onStyleChange: (patch: StyleMap) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const ICONS = ['★', '✓', '→', '✚', '✉', '☎', '⚑', '♥', '⚙', '⌂', '🔒', '⚡', '◆', '●', '▲'];

export default function Inspector({
  node,
  projectId,
  breakpoint,
  onPropsChange,
  onStyleChange,
  onDuplicate,
  onDelete,
}: Props) {
  const [tab, setTab] = useState<'content' | 'style'>('content');

  if (!node) {
    return (
      <p className="p-4 text-sm text-neutral-500">
        Select an element on the canvas to edit it. Double-click a heading or text block to type
        directly into it.
      </p>
    );
  }

  const definition = WIDGETS[node.type];

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-edge px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{definition.label}</span>
          <div className="flex gap-1">
            <button type="button" className="ws-btn px-2 py-1 text-xs" onClick={onDuplicate}>
              Duplicate
            </button>
            <button type="button" className="ws-btn px-2 py-1 text-xs" onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>

        <div className="mt-2 flex gap-1">
          {(['content', 'style'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`flex-1 rounded px-2 py-1 text-xs capitalize transition-colors ${
                tab === value ? 'bg-accent text-white' : 'bg-panelAlt text-neutral-400 hover:text-white'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </header>

      <div className="thin-scroll flex-1 overflow-y-auto p-3">
        {tab === 'content' ? (
          definition.controls.length === 0 ? (
            <p className="text-sm text-neutral-500">This widget has no content options.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {definition.controls.map((control) => (
                <ControlField
                  key={control.key}
                  control={control}
                  value={node.props[control.key]}
                  projectId={projectId}
                  onChange={(value) => onPropsChange({ [control.key]: value })}
                />
              ))}
              {node.type === 'columns' && (
                <ControlField
                  control={{ key: 'count', label: 'Columns', type: 'number' }}
                  value={node.children.length}
                  projectId={projectId}
                  onChange={(value) => onPropsChange({ count: value })}
                />
              )}
            </div>
          )
        ) : (
          <StyleControls node={node} breakpoint={breakpoint} onChange={onStyleChange} />
        )}
      </div>
    </div>
  );
}

function ControlField({
  control,
  value,
  projectId,
  onChange,
}: {
  control: Control;
  value: unknown;
  projectId: string;
  onChange: (value: unknown) => void;
}) {
  switch (control.type) {
    case 'toggle':
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-indigo-500"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
          />
          {control.label}
        </label>
      );

    case 'select':
      return (
        <label className="block">
          <span className="ws-label">{control.label}</span>
          <select className="ws-field" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>
            {(control.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );

    case 'number':
      return (
        <label className="block">
          <span className="ws-label">{control.label}</span>
          <input
            type="number"
            className="ws-field"
            value={Number(value ?? 0)}
            onChange={(event) => onChange(Number(event.target.value))}
          />
        </label>
      );

    case 'textarea':
    case 'richtext':
      return (
        <label className="block">
          <span className="ws-label">{control.label}</span>
          <textarea
            className="ws-field min-h-24 font-mono text-xs"
            value={String(value ?? '')}
            onChange={(event) => onChange(event.target.value)}
          />
          {control.help && <p className="mt-1 text-[11px] text-neutral-500">{control.help}</p>}
        </label>
      );

    case 'image':
      return <ImageField label={control.label} value={String(value ?? '')} projectId={projectId} onChange={onChange} />;

    case 'icon':
      return (
        <div>
          <span className="ws-label">{control.label}</span>
          <div className="flex flex-wrap gap-1">
            {ICONS.map((glyph) => (
              <button
                key={glyph}
                type="button"
                onClick={() => onChange(glyph)}
                className={`h-8 w-8 rounded border text-base ${
                  value === glyph ? 'border-accent bg-accent/20' : 'border-edge bg-panelAlt hover:border-neutral-500'
                }`}
              >
                {glyph}
              </button>
            ))}
          </div>
          <input
            className="ws-field mt-2"
            value={String(value ?? '')}
            placeholder="Or paste any character"
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      );

    case 'repeater':
      return (
        <Repeater
          control={control}
          items={Array.isArray(value) ? (value as Record<string, unknown>[]) : []}
          projectId={projectId}
          onChange={onChange}
        />
      );

    default:
      return (
        <label className="block">
          <span className="ws-label">{control.label}</span>
          <input
            className="ws-field"
            value={String(value ?? '')}
            placeholder={control.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />
          {control.help && <p className="mt-1 text-[11px] text-neutral-500">{control.help}</p>}
        </label>
      );
  }
}

function ImageField({
  label,
  value,
  projectId,
  onChange,
}: {
  label: string;
  value: string;
  projectId: string;
  onChange: (value: unknown) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('projectId', projectId);

      const response = await fetch('/api/assets', { method: 'POST', body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? 'Upload failed');

      onChange(payload.asset.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <span className="ws-label">{label}</span>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mb-2 max-h-28 w-full rounded border border-edge object-contain" />
      )}
      <div className="flex gap-1">
        <input
          className="ws-field"
          value={value}
          placeholder="Paste a URL, or upload"
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" className="ws-btn shrink-0 px-2" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? '…' : 'Upload'}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={upload} />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

/** Repeatable item lists: slider slides, tab panels, accordion rows. */
function Repeater({
  control,
  items,
  projectId,
  onChange,
}: {
  control: Control;
  items: Record<string, unknown>[];
  projectId: string;
  onChange: (value: unknown) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const update = (index: number, patch: Record<string, unknown>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    setOpenIndex(target);
  };

  return (
    <div>
      <span className="ws-label">{control.label}</span>

      <div className="flex flex-col gap-1">
        {items.map((item, index) => (
          <div key={index} className="rounded border border-edge bg-panelAlt">
            <div className="flex items-center gap-1 px-2 py-1.5">
              <button
                type="button"
                className="flex-1 truncate text-left text-xs text-neutral-300 hover:text-white"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                {String(item.title ?? item.heading ?? `Item ${index + 1}`) || `Item ${index + 1}`}
              </button>
              <button type="button" className="px-1 text-xs text-neutral-500 hover:text-white" onClick={() => move(index, -1)} title="Move up">
                ↑
              </button>
              <button type="button" className="px-1 text-xs text-neutral-500 hover:text-white" onClick={() => move(index, 1)} title="Move down">
                ↓
              </button>
              <button
                type="button"
                className="px-1 text-xs text-neutral-500 hover:text-red-400"
                title="Remove"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                ✕
              </button>
            </div>

            {openIndex === index && (
              <div className="flex flex-col gap-2 border-t border-edge p-2">
                {(control.fields ?? []).map((field) => (
                  <ControlField
                    key={field.key}
                    control={field}
                    value={item[field.key]}
                    projectId={projectId}
                    onChange={(value) => update(index, { [field.key]: value })}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        className="ws-btn mt-2 w-full text-xs"
        onClick={() => {
          onChange([...items, { ...(control.itemDefaults ?? {}) }]);
          setOpenIndex(items.length);
        }}
      >
        + Add item
      </button>
    </div>
  );
}
