'use client';

import { PALETTE } from '@/lib/builder/widgets';
import type { WidgetType } from '@/lib/builder/types';
import { dragState } from './dragState';

const CATEGORY_LABELS: Record<string, string> = {
  layout: 'Layout',
  content: 'Content',
  dynamic: 'Dynamic',
};

interface Props {
  /** Click-to-add, for when dragging is awkward (touch, or a deep target). */
  onAdd: (type: WidgetType) => void;
}

export default function WidgetPalette({ onAdd }: Props) {
  const grouped = ['layout', 'content', 'dynamic'].map((category) => ({
    category,
    widgets: PALETTE.filter((widget) => widget.category === category),
  }));

  return (
    <div className="thin-scroll h-full overflow-y-auto p-3">
      {grouped.map(({ category, widgets }) => (
        <section key={category} className="mb-5">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            {CATEGORY_LABELS[category]}
          </h3>

          <div className="grid grid-cols-2 gap-2">
            {widgets.map((widget) => (
              <button
                key={widget.type}
                type="button"
                draggable
                onDragStart={(event) => {
                  dragState.set({ kind: 'new', widget: widget.type });
                  event.dataTransfer.effectAllowed = 'copy';
                  event.dataTransfer.setData('text/plain', widget.type);
                }}
                onDragEnd={() => dragState.clear()}
                onClick={() => onAdd(widget.type)}
                title={`Drag onto the canvas, or click to append`}
                className="flex cursor-grab flex-col items-center gap-1 rounded border border-edge bg-panelAlt px-2 py-3 text-xs text-neutral-300 transition-colors hover:border-accent hover:text-white active:cursor-grabbing"
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {widget.icon}
                </span>
                {widget.label}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
