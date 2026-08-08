'use client';

import { useRef, useState } from 'react';

import { WIDGETS } from '@/lib/builder/widgets';
import { ROOT_ID, type BuilderNode } from '@/lib/builder/types';
import Icon from '@/components/Icon';

interface Props {
  tree: BuilderNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Reorder or reparent. `position` is relative to `targetId`. */
  onMove: (nodeId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
}

/** Outline of the document, which is how you reach nodes a click can't hit. */
export default function LayerTree({ tree, selectedId, onSelect, onMove }: Props) {
  // Which row is under the cursor, and where a drop would land within it.
  const [dropHint, setDropHint] = useState<{ id: string; position: 'before' | 'after' | 'inside' } | null>(
    null,
  );
  const draggingId = useRef<string | null>(null);

  return (
    <div
      className="thin-scroll h-full overflow-y-auto p-2 text-sm"
      onDragEnd={() => {
        draggingId.current = null;
        setDropHint(null);
      }}
    >
      {tree.children.length === 0 ? (
        <p className="px-2 py-4 text-center text-[12px] leading-relaxed text-faint">
          This page is empty.
          <br />
          Drop a section onto the canvas.
        </p>
      ) : (
        tree.children.map((child) => (
          <Row
            key={child.id}
            node={child}
            depth={0}
            selectedId={selectedId}
            onSelect={onSelect}
            dropHint={dropHint}
            setDropHint={setDropHint}
            draggingId={draggingId}
            onMove={onMove}
          />
        ))
      )}
    </div>
  );
}

interface RowProps {
  node: BuilderNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  dropHint: { id: string; position: 'before' | 'after' | 'inside' } | null;
  setDropHint: (hint: { id: string; position: 'before' | 'after' | 'inside' } | null) => void;
  draggingId: React.MutableRefObject<string | null>;
  onMove: (nodeId: string, targetId: string, position: 'before' | 'after' | 'inside') => void;
}

function Row({ node, depth, selectedId, onSelect, dropHint, setDropHint, draggingId, onMove }: RowProps) {
  const definition = WIDGETS[node.type];
  const label = describe(node);
  const hint = dropHint?.id === node.id ? dropHint.position : null;

  return (
    <div>
      <button
        type="button"
        draggable
        onDragStart={(event) => {
          draggingId.current = node.id;
          event.dataTransfer.effectAllowed = 'move';
          // Firefox refuses to start a drag without payload on the transfer.
          event.dataTransfer.setData('text/plain', node.id);
        }}
        onDragOver={(event) => {
          if (!draggingId.current || draggingId.current === node.id) return;
          event.preventDefault();

          // Top and bottom thirds reorder; the middle drops inside, which is
          // the only way to reach an empty container from the outline.
          const rect = event.currentTarget.getBoundingClientRect();
          const offset = (event.clientY - rect.top) / rect.height;
          setDropHint({
            id: node.id,
            position: offset < 0.3 ? 'before' : offset > 0.7 ? 'after' : 'inside',
          });
        }}
        onDrop={(event) => {
          event.preventDefault();
          const source = draggingId.current;
          const position = dropHint?.position;
          draggingId.current = null;
          setDropHint(null);
          if (source && position && source !== node.id) onMove(source, node.id, position);
        }}
        onClick={() => onSelect(node.id)}
        style={{ paddingLeft: 6 + depth * 13 }}
        className={`group flex w-full cursor-grab items-center gap-2 rounded-md py-1.5 pr-2 text-left text-[12px] transition-colors duration-150 active:cursor-grabbing ${
          selectedId === node.id
            ? 'bg-accent/12 text-white'
            : 'text-muted hover:bg-panelRaised hover:text-neutral-200'
        } ${hint === 'before' ? 'shadow-[inset_0_2px_0_0_rgb(127_174_107)]' : ''} ${
          hint === 'after' ? 'shadow-[inset_0_-2px_0_0_rgb(127_174_107)]' : ''
        } ${hint === 'inside' ? 'ring-1 ring-inset ring-positive' : ''}`}
      >
        <Icon
          name={definition.icon}
          size={14}
          className={`shrink-0 ${selectedId === node.id ? 'text-accent' : 'text-faint group-hover:text-muted'}`}
        />
        <span className="truncate">{label}</span>
      </button>

      {node.children.map((child) => (
        <Row
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          dropHint={dropHint}
          setDropHint={setDropHint}
          draggingId={draggingId}
          onMove={onMove}
        />
      ))}
    </div>
  );
}

/** Prefer the node's own content over its type, so the outline reads like the page. */
function describe(node: BuilderNode): string {
  const definition = WIDGETS[node.type];
  if (node.id === ROOT_ID) return 'Page';

  if (node.type === 'heading') return String(node.props.text ?? '').slice(0, 40) || definition.label;
  if (node.type === 'button') return String(node.props.text ?? '').slice(0, 40) || definition.label;
  if (node.type === 'text') {
    const plain = String(node.props.html ?? '').replace(/<[^>]*>/g, ' ').trim();
    return plain.slice(0, 40) || definition.label;
  }
  if (node.type === 'image') {
    const alt = String(node.props.alt ?? '');
    return alt ? `Image: ${alt.slice(0, 30)}` : definition.label;
  }
  if (node.classes?.length) return `${definition.label} .${node.classes[0]}`;
  return definition.label;
}
