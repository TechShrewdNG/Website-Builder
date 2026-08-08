import type { BuilderNode, WidgetType } from '@/lib/builder/types';

/**
 * The in-flight drag.
 *
 * Held in a module variable rather than on the DragEvent's dataTransfer:
 * dataTransfer payloads are unreadable during `dragover` in some browsers,
 * and the drop indicator has to know what's being dragged on every move to
 * decide whether the hovered container would even accept it. The canvas
 * listeners run in the parent's JS context even though the events fire inside
 * the iframe, so a shared module is the simplest reliable channel.
 */
export type DragPayload =
  | { kind: 'new'; widget: WidgetType }
  | { kind: 'move'; nodeId: string }
  | { kind: 'paste'; node: BuilderNode };

let current: DragPayload | null = null;

export const dragState = {
  get(): DragPayload | null {
    return current;
  },
  set(payload: DragPayload | null) {
    current = payload;
  },
  clear() {
    current = null;
  },
};
