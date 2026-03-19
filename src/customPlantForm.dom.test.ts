// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateCustomPlantInput } from './customPlantForm';
import { addCustomPlant, _resetCustomPlants, isNameAvailable } from './customPlants';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Builds a minimal set of valid form values. */
function validValues(overrides: Partial<{ name: string; spacingRaw: string }> = {}) {
  return { name: 'My Lavender', spacingRaw: '0.5', ...overrides };
}

/** No-op stubs used when we don't care about the isKnownPlantName path. */
const neverKnown = (_name: string) => false;

// ── validateCustomPlantInput — guard 1: empty name ────────────────────────────

describe('validateCustomPlantInput — empty name', () => {
  it('returns an error when name is empty', () => {
    const result = validateCustomPlantInput(
      validValues({ name: '' }),
      undefined,
      isNameAvailable,
      neverKnown,
    );
    expect(result).toBe('Plant name is required.');
  });

  it('returns an error when name is only whitespace', () => {
    const result = validateCustomPlantInput(
      validValues({ name: '   ' }),
      undefined,
      isNameAvailable,
      neverKnown,
    );
    expect(result).toBe('Plant name is required.');
  });

  it('returns null when name is not empty', () => {
    const result = validateCustomPlantInput(
      validValues({ name: 'Lavender' }),
      undefined,
      isNameAvailable,
      neverKnown,
    );
    expect(result).toBeNull();
  });
});

// ── validateCustomPlantInput — guard 2: spacing out of bounds ─────────────────

describe('validateCustomPlantInput — spacing bounds', () => {
  it('returns an error when spacing is not a number', () => {
    const result = validateCustomPlantInput(
      validValues({ spacingRaw: 'abc' }),
      undefined,
      isNameAvailable,
      neverKnown,
    );
    expect(result).toBe('Spacing must be between 0.10 and 3.0 m.');
  });

  it('returns an error when spacing is below minimum (0.09)', () => {
    const result = validateCustomPlantInput(
      validValues({ spacingRaw: '0.09' }),
      undefined,
      isNameAvailable,
      neverKnown,
    );
    expect(result).toBe('Spacing must be between 0.10 and 3.0 m.');
  });

  it('returns an error when spacing exceeds maximum (3.01)', () => {
    const result = validateCustomPlantInput(
      validValues({ spacingRaw: '3.01' }),
      undefined,
      isNameAvailable,
      neverKnown,
    );
    expect(result).toBe('Spacing must be between 0.10 and 3.0 m.');
  });

  it('returns null at exactly the minimum (0.1)', () => {
    const result = validateCustomPlantInput(
      validValues({ spacingRaw: '0.1' }),
      undefined,
      isNameAvailable,
      neverKnown,
    );
    expect(result).toBeNull();
  });

  it('returns null at exactly the maximum (3.0)', () => {
    const result = validateCustomPlantInput(
      validValues({ spacingRaw: '3.0' }),
      undefined,
      isNameAvailable,
      neverKnown,
    );
    expect(result).toBeNull();
  });
});

// ── validateCustomPlantInput — guard 3: custom plant duplicate ────────────────

describe('validateCustomPlantInput — custom plant duplicate', () => {
  beforeEach(() => {
    _resetCustomPlants();
  });

  it('returns an error when the name already exists in the custom store', () => {
    addCustomPlant({ name: 'My Lavender', spacing: 0.5, color: '#a0a', isCustom: true });
    const result = validateCustomPlantInput(
      validValues({ name: 'My Lavender' }),
      undefined,
      isNameAvailable,
      neverKnown,
    );
    expect(result).toMatch(/already exists/);
  });

  it('is case-insensitive (MY LAVENDER matches my lavender)', () => {
    addCustomPlant({ name: 'my lavender', spacing: 0.5, color: '#a0a', isCustom: true });
    const result = validateCustomPlantInput(
      validValues({ name: 'MY LAVENDER' }),
      undefined,
      isNameAvailable,
      neverKnown,
    );
    expect(result).toMatch(/already exists/);
  });

  it('returns null when the duplicate is the plant being edited (same id excluded)', () => {
    const added = addCustomPlant({
      name: 'My Lavender',
      spacing: 0.5,
      color: '#a0a',
      isCustom: true,
    });
    const result = validateCustomPlantInput(
      validValues({ name: 'My Lavender' }),
      added.id,
      isNameAvailable,
      neverKnown,
    );
    expect(result).toBeNull();
  });

  it('returns null when the store is empty', () => {
    const result = validateCustomPlantInput(validValues(), undefined, isNameAvailable, neverKnown);
    expect(result).toBeNull();
  });
});

// ── validateCustomPlantInput — guard 4: Trefle database duplicate ─────────────

describe('validateCustomPlantInput — Trefle database duplicate', () => {
  beforeEach(() => {
    _resetCustomPlants();
  });

  it('returns an error when name matches a known Trefle plant', () => {
    // Use a spy that always returns true for this specific name.
    const isKnown = vi.fn().mockReturnValue(true);
    const result = validateCustomPlantInput(
      validValues({ name: 'Rosa canina' }),
      undefined,
      isNameAvailable,
      isKnown,
    );
    expect(result).toMatch(/already the name of a plant in the database/);
    expect(isKnown).toHaveBeenCalledWith('Rosa canina');
  });

  it('returns null when name is not in the Trefle database', () => {
    const isKnown = vi.fn().mockReturnValue(false);
    const result = validateCustomPlantInput(
      validValues({ name: 'Totally Made Up Plant' }),
      undefined,
      isNameAvailable,
      isKnown,
    );
    expect(result).toBeNull();
  });

  it('checks Trefle only after custom-store check passes', () => {
    // If a name is blocked by the custom store, the Trefle check should never be reached.
    addCustomPlant({ name: 'Shared Name', spacing: 0.5, color: '#000', isCustom: true });
    const isKnown = vi.fn().mockReturnValue(true);
    validateCustomPlantInput(
      validValues({ name: 'Shared Name' }),
      undefined,
      isNameAvailable,
      isKnown,
    );
    expect(isKnown).not.toHaveBeenCalled();
  });
});

// ── DOM-level smoke test: alert fires and prevents save ───────────────────────
//
// The cpSaveBtn handler lives inside main.ts which cannot be imported without a
// full DOM environment including all SVG elements. Instead, we verify the contract
// at the integration boundary: window.alert is called whenever validateCustomPlantInput
// returns a non-null error.  We test that contract using a minimal DOM stub that
// mirrors what the real handler does.

describe('DOM smoke test — alert fires for each guard', () => {
  beforeEach(() => {
    _resetCustomPlants();
    vi.stubGlobal('alert', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function simulateSave(
    nameVal: string,
    spacingVal: string,
    editId?: string,
    isKnown: (n: string) => boolean = () => false,
  ): boolean {
    // Mirrors the real cpSaveBtn click handler's call to validateCustomPlantInput
    // followed by alert + return-on-error pattern.
    const error = validateCustomPlantInput(
      { name: nameVal, spacingRaw: spacingVal },
      editId,
      isNameAvailable,
      isKnown,
    );
    if (error) {
      window.alert(error);
      return false; // did not save
    }
    return true; // would save
  }

  it('alerts and returns false for empty name', () => {
    const saved = simulateSave('', '0.5');
    expect(saved).toBe(false);
    expect(window.alert).toHaveBeenCalledWith('Plant name is required.');
  });

  it('alerts and returns false for out-of-range spacing', () => {
    const saved = simulateSave('Lavender', '99');
    expect(saved).toBe(false);
    expect(window.alert).toHaveBeenCalledWith('Spacing must be between 0.10 and 3.0 m.');
  });

  it('alerts and returns false for custom-store duplicate', () => {
    addCustomPlant({ name: 'Lavender', spacing: 0.5, color: '#ccc', isCustom: true });
    const saved = simulateSave('Lavender', '0.5');
    expect(saved).toBe(false);
    expect(window.alert).toHaveBeenCalledWith(
      'A custom plant named "Lavender" already exists. Please use a different name.',
    );
  });

  it('alerts and returns false for Trefle database duplicate', () => {
    const saved = simulateSave('Rosa canina', '0.5', undefined, () => true);
    expect(saved).toBe(false);
    expect(window.alert).toHaveBeenCalledWith(
      '"Rosa canina" is already the name of a plant in the database. Please use a different name.',
    );
  });

  it('returns true (save proceeds) when all guards pass', () => {
    const saved = simulateSave('My Unique Plant', '0.5');
    expect(saved).toBe(true);
    expect(window.alert).not.toHaveBeenCalled();
  });
});
