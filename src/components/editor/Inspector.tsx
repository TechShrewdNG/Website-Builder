'use client';

import { useRef, useState } from 'react';

import { WIDGETS, type Control } from '@/lib/builder/widgets';
import type { BuilderNode, Breakpoint, StyleMap } from '@/lib/builder/types';
import StyleControls from './StyleControls';
import Icon from '@/components/Icon';

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
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-edge bg-panelRaised text-muted">
          <Icon name="pencil" size={19} />
        </span>
        <p className="text-[13px] font-medium text-neutral-300">Nothing selected</p>
        <p className="max-w-[210px] text-[12px] leading-relaxed text-faint">
          Click any element on the canvas to edit it, or double-click a heading to type straight
          into the page.
        </p>
      </div>
    );
  }

  const definition = WIDGETS[node.type];

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-edge px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <Icon name={definition.icon} size={16} className="shrink-0 text-accent" />
            <span className="truncate text-[13px] font-semibold text-white">{definition.label}</span>
          </span>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              title="Duplicate (Ctrl/Cmd+D)"
              aria-label="Duplicate"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-panelRaised hover:text-white"
              onClick={onDuplicate}
            >
              <Icon name="copy" size={15} />
            </button>
            <button
              type="button"
              title="Delete"
              aria-label="Delete"
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
              onClick={onDelete}
            >
              <Icon name="trash" size={15} />
            </button>
          </div>
        </div>

        {/* Sliding indicator rather than two filled pills, so the inactive tab
            stays legible instead of reading as disabled. */}
        <div className="relative mt-2.5 flex rounded-lg bg-[#121216] p-0.5">
          <span
            aria-hidden="true"
            className="absolute inset-y-0.5 w-[calc(50%-2px)] rounded-md bg-panelRaised shadow-[var(--ws-shadow-sm)] transition-transform duration-200 ease-out"
            style={{ transform: tab === 'content' ? 'translateX(2px)' : 'translateX(calc(100% + 2px))' }}
          />
          {(['content', 'style'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              aria-pressed={tab === value}
              className={`relative z-10 flex-1 rounded-md py-1.5 text-[12px] font-medium capitalize transition-colors duration-150 ${
                tab === value ? 'text-white' : 'text-muted hover:text-neutral-300'
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
            <p className="text-[12px] text-faint">This widget has no content options — style it instead.</p>
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
        <label className="flex cursor-pointer items-center gap-2.5 rounded-md py-0.5 text-[13px] text-neutral-300 transition-colors hover:text-white">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[rgb(215_155_60)]"
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
            className="ws-field min-h-24 font-mono text-[11px] leading-relaxed"
            value={String(value ?? '')}
            onChange={(event) => onChange(event.target.value)}
          />
          {control.help && <p className="mt-1.5 text-[11px] leading-relaxed text-faint">{control.help}</p>}
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
                className={`h-8 w-8 rounded-md border text-base transition-colors duration-150 ${
                  value === glyph
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-edge bg-panelRaised text-neutral-300 hover:border-edgeStrong hover:text-white'
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
          {control.help && <p className="mt-1.5 text-[11px] leading-relaxed text-faint">{control.help}</p>}
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
        <img
          src={value}
          alt="Selected image preview"
          className="mb-2 max-h-28 w-full rounded-lg border border-edge bg-[#0c0c0f] object-contain p-1"
        />
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
      {error && <p className="mt-1.5 text-[11px] leading-relaxed text-danger">{error}</p>}
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
          <div key={index} className="overflow-hidden rounded-lg border border-edge bg-panelRaised transition-colors duration-150 hover:border-edgeStrong">
            <div className="flex items-center gap-1 px-2 py-1.5">
              <button
                type="button"
                className="flex-1 truncate text-left text-[12px] text-neutral-300 transition-colors duration-150 hover:text-white"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              >
                {String(item.title ?? item.heading ?? `Item ${index + 1}`) || `Item ${index + 1}`}
              </button>
              <button
                type="button"
                className="flex h-6 w-5 items-center justify-center rounded text-faint transition-colors duration-150 hover:bg-panel hover:text-white"
                onClick={() => move(index, -1)}
                title="Move up"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="flex h-6 w-5 items-center justify-center rounded text-faint transition-colors duration-150 hover:bg-panel hover:text-white"
                onClick={() => move(index, 1)}
                title="Move down"
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="flex h-6 w-5 items-center justify-center rounded text-faint transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
                title="Remove"
                aria-label="Remove"
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
        className="ws-btn mt-2 w-full py-1.5 text-[12px]"
        onClick={() => {
          onChange([...items, { ...(control.itemDefaults ?? {}) }]);
          setOpenIndex(items.length);
        }}
      >
        <Icon name="plus" size={14} />
        Add item
      </button>
    </div>
  );
}
