'use client';

import { useState } from 'react';

import { PALETTE } from '@/lib/builder/widgets';
import { BLOCKS, type BlockDefinition } from '@/lib/builder/blocks';
import type { WidgetType } from '@/lib/builder/types';
import Icon from '@/components/Icon';
import { dragState } from './dragState';

const CATEGORIES = [
  { key: 'layout', label: 'Layout', hint: 'Structure the page' },
  { key: 'content', label: 'Content', hint: 'Text, media, links' },
  { key: 'dynamic', label: 'Interactive', hint: 'Needs JavaScript' },
] as const;

const BLOCK_CATEGORIES: BlockDefinition['category'][] = ['Hero', 'Content', 'Social proof', 'Conversion', 'Footer'];

interface Props {
  /** Click-to-add, for when dragging is awkward (touch, or a deep target). */
  onAdd: (type: WidgetType) => void;
  onAddBlock: (block: BlockDefinition) => void;
}

export default function WidgetPalette({ onAdd, onAddBlock }: Props) {
  const [view, setView] = useState<'widgets' | 'blocks'>('widgets');

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-0.5 border-b border-edge px-3 py-2">
        {(
          [
            { key: 'widgets', label: 'Elements' },
            { key: 'blocks', label: 'Blocks' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            aria-pressed={view === key}
            className={`flex-1 rounded-md py-1.5 text-[11.5px] font-medium transition-colors duration-150 ${
              view === key
                ? 'bg-panelRaised text-white'
                : 'text-muted hover:bg-panelRaised/60 hover:text-neutral-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'widgets' ? (
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3">
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
                        hover:border-accent/35 hover:bg-[#2d1444] hover:text-white
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
      ) : (
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-3">
          {BLOCK_CATEGORIES.map((category) => {
            const blocks = BLOCKS.filter((block) => block.category === category);
            if (!blocks.length) return null;

            return (
              <section key={category} className="mb-6">
                <h3 className="mb-2.5 px-0.5 text-[12px] font-semibold text-neutral-200">{category}</h3>

                <div className="flex flex-col gap-1.5">
                  {blocks.map((block) => (
                    <button
                      key={block.id}
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        dragState.set({ kind: 'block', node: block.build() });
                        event.dataTransfer.effectAllowed = 'copy';
                        event.dataTransfer.setData('text/plain', block.id);
                      }}
                      onDragEnd={() => dragState.clear()}
                      onClick={() => onAddBlock(block)}
                      title="Drag onto the canvas, or click to add to the end of the page"
                      className="group flex cursor-grab flex-col gap-0.5 rounded-lg border border-transparent
                        bg-panelRaised px-3 py-2.5 text-left transition-[background-color,border-color,color] duration-150
                        hover:border-accent/35 hover:bg-[#2d1444] active:translate-y-px active:cursor-grabbing"
                    >
                      <span className="flex items-center gap-2 text-[12.5px] font-medium text-neutral-200 group-hover:text-white">
                        <Icon name="blocks" size={14} className="shrink-0 text-faint group-hover:text-accent" />
                        {block.name}
                      </span>
                      <span className="pl-[22px] text-[11px] leading-snug text-faint">{block.description}</span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}

          <p className="mt-2 border-t border-edge px-0.5 pt-4 text-[11px] leading-relaxed text-faint">
            Blocks drop onto the end of the page. Everything inside is a regular widget, edit it the same way.
          </p>
        </div>
      )}
    </div>
  );
}
