export interface PlantOverride {
  spacing?: number;
  color?: string;
}

export type StoreResult = { ok: true } | { ok: false; error: string };

// ── Validation helpers ─────────────────────────────────────────────────────

const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

function validateOverride(updates: PlantOverride): StoreResult {
  if (updates.spacing !== undefined) {
    if (isNaN(updates.spacing) || updates.spacing < 0.1 || updates.spacing > 3.0)
      return { ok: false, error: 'Spacing must be between 0.10 and 3.0 m.' };
  }
  if (updates.color !== undefined) {
    if (!HEX_RE.test(updates.color))
      return { ok: false, error: 'Color must be a CSS hex string (e.g. #e91e63).' };
  }
  return { ok: true };
}

// ── Store state ────────────────────────────────────────────────────────────

let overrides = new Map<string, PlantOverride>();
const subscribers: Array<() => void> = [];

function notify(): void {
  subscribers.forEach((fn) => fn());
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Returns the user override for a Trefle slug, or null if none exists. */
export function getOverride(slug: string): PlantOverride | null {
  return overrides.get(slug) ?? null;
}

/** Merges fields into the override for a slug. Validates before writing — no partial writes. */
export function setOverride(slug: string, updates: PlantOverride): StoreResult {
  if (!slug.trim()) return { ok: false, error: 'Slug is required.' };
  const validation = validateOverride(updates);
  if (!validation.ok) return validation;

  const existing = overrides.get(slug) ?? {};
  overrides.set(slug, { ...existing, ...updates });
  notify();
  return { ok: true };
}

/** Removes the override for a slug. Returns false if no override existed. */
export function deleteOverride(slug: string): boolean {
  if (!overrides.has(slug)) return false;
  overrides.delete(slug);
  notify();
  return true;
}

/** Registers a callback to run whenever the store changes. */
export function subscribe(fn: () => void): void {
  subscribers.push(fn);
}

/** Returns all current overrides as a plain object (for serialisation). */
export function getAllOverrides(): Record<string, PlantOverride> {
  return Object.fromEntries(overrides);
}

/** Replaces the entire override store (for deserialisation). Notifies subscribers. */
export function restoreOverrides(data: Record<string, PlantOverride>): void {
  overrides = new Map(Object.entries(data));
  notify();
}

/** Resets store to empty state. For tests only. */
export function _resetStore(): void {
  overrides = new Map();
  subscribers.length = 0;
}
