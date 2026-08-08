'use client';

import { WIDGETS } from '@/lib/builder/widgets';
import { ROOT_ID, type BuilderNode } from '@/lib/builder/types';

interface Props {
  tree: BuilderNode;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Outline of the document, which is how you reach nodes a click can't hit. */
export default function LayerTree({ tree, selectedId, onSelect }: Props) {
  return (
    <div className="thin-scroll h-full overflow-y-auto p-2 text-sm">
      {tree.children.length === 0 ? (
        <p className="p-2 text-xs text-neutral-500">The page is empty. Drop a section onto the canvas.</p>
      ) : (
        tree.children.map((child) => (
          <Row key={child.id} node={child} depth={0} selectedId={selectedId} onSelect={onSelect} />
        ))
      )}
    </div>
  );
}

function Row({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: BuilderNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const definition = WIDGETS[node.type];
  const label = describe(node);

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        style={{ paddingLeft: 8 + depth * 12 }}
        className={`flex w-full items-center gap-2 rounded py-1 pr-2 text-left text-xs transition-colors ${
          selectedId === node.id ? 'bg-accent/25 text-white' : 'text-neutral-400 hover:bg-panelAlt hover:text-white'
        }`}
      >
        <span aria-hidden="true" className="w-4 shrink-0 text-center">
          {definition.icon}
        </span>
        <span className="truncate">{label}</span>
      </button>

      {node.children.map((child) => (
        <Row key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
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
