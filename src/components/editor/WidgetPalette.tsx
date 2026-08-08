'use client';

import { PALETTE } from '@/lib/builder/widgets';
import type { WidgetType } from '@/lib/builder/types';
import Icon from '@/components/Icon';
import { dragState } from './dragState';

const CATEGORIES = [
  { key: 'layout', label: 'Layout', hint: 'Structure the page' },
  { key: 'content', label: 'Content', hint: 'Text, media, links' },
  { key: 'dynamic', label: 'Interactive', hint: 'Needs JavaScript' },
] as const;

interface Props {
  /** Click-to-add, for when dragging is awkward (touch, or a deep target). */
  onAdd: (type: WidgetType) => void;
}

export default function WidgetPalette({ onAdd }: Props) {
  return (
    <div className="thin-scroll h-full overflow-y-auto px-3 pb-6 pt-3">
      {CATEGORIES.map(({ key, label, hint }) => {
        const widgets = PALETTE.filter((widget) => widget.category === key);
        if (!widgets.length) return null;

        return (
          <section key={key} className="mb-6">
            <div className="mb-2.5 flex items-baseline justify-between gap-2 px-0.5">
              <h3 className="text-[12px] font-semibold text-neutral-200">{label}</h3>
              <span className="text-[10px] text-faint">{hint}</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {widgets.map((widget, index) => (
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
                  title="Drag onto the canvas, or click to add"
                  className={`group flex cursor-grab items-center gap-2 rounded-lg border border-transparent
                    bg-panelRaised px-2.5 py-2.5 text-left text-[12px] text-neutral-300
                    transition-[background-color,border-color,color,transform] duration-150
                    hover:border-accent/35 hover:bg-[#24242b] hover:text-white
                    active:translate-y-px active:cursor-grabbing
                    ${
                      // An odd count would otherwise leave a gap in the row.
                      index === widgets.length - 1 && widgets.length % 2 === 1 ? 'col-span-2' : ''
                    }`}
                >
                  <Icon
                    name={widget.icon}
                    size={16}
                    className="shrink-0 text-faint transition-colors duration-150 group-hover:text-accent"
                  />
                  {widget.label}
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <p className="mt-2 border-t border-edge px-0.5 pt-4 text-[11px] leading-relaxed text-faint">
        Drop a widget onto the canvas, or click to add it inside whatever is selected.
      </p>
    </div>
  );
}
