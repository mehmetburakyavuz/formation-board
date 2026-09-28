import { isRole, type Formation, type FormationSlot } from '../data/formations';
import type { LibraryEntry, TacticDocument } from './schema';
import { parseTacticDocument } from './validate';

const CUSTOM_FORMATIONS_KEY = 'formasyon.customFormations.v1';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isUnit(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= -0.1 && v <= 1.1;
}

function parseSlot(v: unknown): FormationSlot | null {
  if (!isRecord(v)) return null;
  const { role, nx, ny } = v;
  if (typeof role !== 'string' || !isRole(role) || !isUnit(nx) || !isUnit(ny)) return null;
  return { role, nx, ny };
}

export function parseFormation(v: unknown): Formation | null {
  if (!isRecord(v)) return null;
  const { id, name, slots } = v;
  if (typeof id !== 'string' || typeof name !== 'string' || !Array.isArray(slots)) return null;
  if (slots.length !== 11) return null;
  const parsed = slots.map(parseSlot);
  if (parsed.some((s) => s === null)) return null;
  return { id, name, slots: parsed as FormationSlot[] };
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadCustomFormations(): Formation[] {
  try {
    const raw = storage()?.getItem(CUSTOM_FORMATIONS_KEY);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map(parseFormation).filter((f): f is Formation => f !== null);
  } catch {
    return [];
  }
}

export function saveCustomFormations(list: readonly Formation[]): void {
  try {
    storage()?.setItem(CUSTOM_FORMATIONS_KEY, JSON.stringify(list));
  } catch {
    // Storage full or blocked: custom formations stay in memory for this session.
  }
}

// --- Autosave & tactic library ------------------------------------------------------

const AUTOSAVE_KEY = 'formasyon.autosave.v1';
const LIBRARY_KEY = 'formasyon.library.v1';

function write(key: string, value: unknown): boolean {
  try {
    const s = storage();
    if (!s) return false;
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function read(key: string): unknown {
  try {
    const raw = storage()?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function saveAutosave(doc: TacticDocument): boolean {
  return write(AUTOSAVE_KEY, doc);
}

/** Last autosaved board, or null if missing/invalid. */
export function loadAutosave(): TacticDocument | null {
  const data = read(AUTOSAVE_KEY);
  if (!data) return null;
  const r = parseTacticDocument(data);
  return r.ok ? r.doc : null;
}

export function loadLibrary(): LibraryEntry[] {
  const data = read(LIBRARY_KEY);
  if (!Array.isArray(data)) return [];
  const out: LibraryEntry[] = [];
  for (const item of data) {
    if (!isRecord(item)) continue;
    const { id, name, savedAt } = item;
    if (typeof id !== 'string' || typeof name !== 'string' || typeof savedAt !== 'string') continue;
    const r = parseTacticDocument(item.doc);
    if (r.ok) out.push({ id, name, savedAt, doc: r.doc });
  }
  return out;
}

export function saveLibrary(list: readonly LibraryEntry[]): boolean {
  return write(LIBRARY_KEY, list);
}
