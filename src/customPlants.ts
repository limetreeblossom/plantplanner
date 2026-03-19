import type { Plant } from './types';

// ── Custom plant store ─────────────────────────────────────────────────────────
// Stores user-created plants that persist in the project save file.

let customPlants: Plant[] = [];
const subscribers: Array<() => void> = [];

function notify(): void {
  subscribers.forEach((fn) => fn());
}

/** Returns a copy of all custom plants. */
export function getCustomPlants(): Plant[] {
  return [...customPlants];
}

/** Generates a stable string id for a custom plant. */
function generateId(): string {
  return `cp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Adds a new custom plant. Returns the added plant. */
export function addCustomPlant(plant: Plant): Plant {
  const p: Plant = { ...plant, isCustom: true, id: plant.id ?? generateId() };
  customPlants.push(p);
  notify();
  return p;
}

/** Replaces a custom plant in-place by identity (array index). Returns false if not found. */
export function updateCustomPlant(index: number, updates: Partial<Plant>): boolean {
  if (index < 0 || index >= customPlants.length) return false;
  customPlants[index] = { ...customPlants[index], ...updates, isCustom: true };
  notify();
  return true;
}

/** Removes a custom plant by index. Returns false if index is out of range. */
export function removeCustomPlant(index: number): boolean {
  if (index < 0 || index >= customPlants.length) return false;
  customPlants.splice(index, 1);
  notify();
  return true;
}

/** Registers a callback invoked whenever the store changes. */
export function subscribe(fn: () => void): void {
  subscribers.push(fn);
}

/** Returns a plain array suitable for JSON serialisation. */
export function getAllCustomPlants(): Plant[] {
  return [...customPlants];
}

/** Replaces the full store (for deserialisation after load). Notifies subscribers. */
export function restoreCustomPlants(plants: Plant[]): void {
  // Preserve existing ids (round-trip safe). Generate a new id for any plant
  // that lacks one (e.g. saves created before the id field was introduced).
  customPlants = plants.map((p) => ({ ...p, isCustom: true, id: p.id ?? generateId() }));
  notify();
}

/**
 * Returns true if the given name is available (case-insensitive, trimmed).
 * When editing an existing plant, pass its id as `excludeId` to allow
 * saving without triggering a false duplicate error on the current plant.
 */
export function isNameAvailable(name: string, excludeId?: string): boolean {
  const lower = name.trim().toLowerCase();
  return !customPlants.some((p) => p.name.trim().toLowerCase() === lower && p.id !== excludeId);
}

/** Resets store to empty state. For tests only. */
export function _resetCustomPlants(): void {
  customPlants = [];
  subscribers.length = 0;
}
