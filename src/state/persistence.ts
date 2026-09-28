import { isRole, type Formation, type FormationSlot } from '../data/formations';

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
