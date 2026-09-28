import type { ToolId } from '../state/schema';

/** Directive tools in toolbar order with their keyboard shortcuts. */
export const TOOL_KEYS: readonly { id: ToolId; key: string }[] = [
  { id: 'select', key: 'V' },
  { id: 'run', key: 'A' },
  { id: 'pass', key: 'P' },
  { id: 'dribble', key: 'D' },
  { id: 'zone', key: 'Z' },
  { id: 'note', key: 'N' },
  { id: 'eraser', key: 'E' },
];
