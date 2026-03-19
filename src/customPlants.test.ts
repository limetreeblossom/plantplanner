import { describe, it, expect, beforeEach } from 'vitest';
import {
  addCustomPlant,
  getCustomPlants,
  updateCustomPlant,
  removeCustomPlant,
  subscribe,
  getAllCustomPlants,
  restoreCustomPlants,
  isNameAvailable,
  _resetCustomPlants,
} from './customPlants';
import type { Plant } from './types';

function plant(overrides: Partial<Plant> = {}): Plant {
  return { name: 'My Rose', spacing: 0.5, color: '#f48fb1', ...overrides };
}

beforeEach(() => {
  _resetCustomPlants();
});

// ── addCustomPlant ─────────────────────────────────────────────────────────────

describe('addCustomPlant', () => {
  it('adds a plant and marks it isCustom', () => {
    addCustomPlant(plant());
    const all = getCustomPlants();
    expect(all).toHaveLength(1);
    expect(all[0].isCustom).toBe(true);
  });

  it('returns the added plant with isCustom set', () => {
    const result = addCustomPlant(plant({ name: 'Lavender' }));
    expect(result.name).toBe('Lavender');
    expect(result.isCustom).toBe(true);
  });

  it('preserves all provided fields', () => {
    const p = plant({ name: 'Oak', spacing: 2.0, icon: 'tree', height_cm: 400 });
    addCustomPlant(p);
    const stored = getCustomPlants()[0];
    expect(stored.name).toBe('Oak');
    expect(stored.spacing).toBe(2.0);
    expect(stored.icon).toBe('tree');
    expect(stored.height_cm).toBe(400);
  });

  it('can add multiple plants', () => {
    addCustomPlant(plant({ name: 'A' }));
    addCustomPlant(plant({ name: 'B' }));
    expect(getCustomPlants()).toHaveLength(2);
  });

  it('notifies subscribers', () => {
    let calls = 0;
    subscribe(() => calls++);
    addCustomPlant(plant());
    expect(calls).toBe(1);
  });
});

// ── updateCustomPlant ──────────────────────────────────────────────────────────

describe('updateCustomPlant', () => {
  it('updates the plant at the given index', () => {
    addCustomPlant(plant({ name: 'A' }));
    updateCustomPlant(0, { name: 'B', spacing: 0.8 });
    expect(getCustomPlants()[0].name).toBe('B');
    expect(getCustomPlants()[0].spacing).toBe(0.8);
  });

  it('preserves fields not included in updates', () => {
    addCustomPlant(plant({ name: 'A', color: '#fff' }));
    updateCustomPlant(0, { spacing: 1.0 });
    expect(getCustomPlants()[0].color).toBe('#fff');
  });

  it('keeps isCustom true after update', () => {
    addCustomPlant(plant());
    updateCustomPlant(0, { name: 'Updated' });
    expect(getCustomPlants()[0].isCustom).toBe(true);
  });

  it('returns false for out-of-range index', () => {
    expect(updateCustomPlant(0, { name: 'X' })).toBe(false);
    expect(updateCustomPlant(-1, { name: 'X' })).toBe(false);
  });

  it('notifies subscribers', () => {
    addCustomPlant(plant());
    let calls = 0;
    subscribe(() => calls++);
    updateCustomPlant(0, { name: 'Changed' });
    expect(calls).toBe(1);
  });
});

// ── removeCustomPlant ──────────────────────────────────────────────────────────

describe('removeCustomPlant', () => {
  it('removes the plant at the given index', () => {
    addCustomPlant(plant({ name: 'A' }));
    addCustomPlant(plant({ name: 'B' }));
    removeCustomPlant(0);
    const all = getCustomPlants();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('B');
  });

  it('returns true on successful removal', () => {
    addCustomPlant(plant());
    expect(removeCustomPlant(0)).toBe(true);
  });

  it('returns false for out-of-range index', () => {
    expect(removeCustomPlant(0)).toBe(false);
    expect(removeCustomPlant(-1)).toBe(false);
  });

  it('notifies subscribers', () => {
    addCustomPlant(plant());
    let calls = 0;
    subscribe(() => calls++);
    removeCustomPlant(0);
    expect(calls).toBe(1);
  });
});

// ── getAllCustomPlants ─────────────────────────────────────────────────────────

describe('getAllCustomPlants', () => {
  it('returns a copy — mutations do not affect the store', () => {
    addCustomPlant(plant({ name: 'A' }));
    const copy = getAllCustomPlants();
    copy.push(plant({ name: 'X' }));
    expect(getCustomPlants()).toHaveLength(1);
  });
});

// ── restoreCustomPlants ───────────────────────────────────────────────────────

describe('restoreCustomPlants', () => {
  it('replaces existing plants with the given list', () => {
    addCustomPlant(plant({ name: 'Old' }));
    restoreCustomPlants([plant({ name: 'New' })]);
    const all = getCustomPlants();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('New');
  });

  it('marks all restored plants as isCustom', () => {
    restoreCustomPlants([plant({ isCustom: false })]);
    expect(getCustomPlants()[0].isCustom).toBe(true);
  });

  it('restoring an empty array clears the store', () => {
    addCustomPlant(plant());
    restoreCustomPlants([]);
    expect(getCustomPlants()).toHaveLength(0);
  });

  it('notifies subscribers', () => {
    let calls = 0;
    subscribe(() => calls++);
    restoreCustomPlants([plant()]);
    expect(calls).toBe(1);
  });

  it('preserves id from the save file so round-tripped plants remain editable', () => {
    const savedId = 'cp-test-id-123';
    restoreCustomPlants([plant({ name: 'Saved', id: savedId })]);
    expect(getCustomPlants()[0].id).toBe(savedId);
  });
});

// ── id generation ─────────────────────────────────────────────────────────────

describe('addCustomPlant id', () => {
  it('generates a non-empty id string when none is provided', () => {
    const result = addCustomPlant(plant());
    expect(typeof result.id).toBe('string');
    expect(result.id!.length).toBeGreaterThan(0);
  });

  it('preserves an existing id if one is supplied', () => {
    const result = addCustomPlant(plant({ id: 'my-stable-id' }));
    expect(result.id).toBe('my-stable-id');
  });

  it('assigns unique ids to different plants', () => {
    const a = addCustomPlant(plant({ name: 'A' }));
    const b = addCustomPlant(plant({ name: 'B' }));
    expect(a.id).not.toBe(b.id);
  });
});

// ── isNameAvailable ───────────────────────────────────────────────────────────

describe('isNameAvailable', () => {
  it('returns true when the store is empty', () => {
    expect(isNameAvailable('Rose')).toBe(true);
  });

  it('returns true when no plant has the given name', () => {
    addCustomPlant(plant({ name: 'Lavender' }));
    expect(isNameAvailable('Rose')).toBe(true);
  });

  it('returns false when a plant with the same name exists', () => {
    addCustomPlant(plant({ name: 'Rose' }));
    expect(isNameAvailable('Rose')).toBe(false);
  });

  it('is case-insensitive', () => {
    addCustomPlant(plant({ name: 'Rose' }));
    expect(isNameAvailable('rose')).toBe(false);
    expect(isNameAvailable('ROSE')).toBe(false);
    expect(isNameAvailable('rOsE')).toBe(false);
  });

  it('trims whitespace before comparing', () => {
    addCustomPlant(plant({ name: 'Rose' }));
    expect(isNameAvailable('  Rose  ')).toBe(false);
  });

  it('returns true when the only match is the excluded id (edit mode)', () => {
    const added = addCustomPlant(plant({ name: 'Rose' }));
    // Editing "Rose" — should be allowed to keep the same name
    expect(isNameAvailable('Rose', added.id)).toBe(true);
  });

  it('returns false when a different plant has the same name even with excludeId set', () => {
    addCustomPlant(plant({ name: 'Rose' }));
    const b = addCustomPlant(plant({ name: 'Rose 2' }));
    // Editing plant "Rose 2" (excludeId = b.id) but trying to rename it to "Rose"
    // — "Rose" is taken by a different plant, so the name is not available
    expect(isNameAvailable('Rose', b.id!)).toBe(false);
  });

  it('allows the same name after the conflicting plant is removed', () => {
    addCustomPlant(plant({ name: 'Rose' }));
    removeCustomPlant(0);
    expect(isNameAvailable('Rose')).toBe(true);
  });
});
