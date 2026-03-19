/**
 * Pure validation helpers for the custom plant form.
 * Kept separate from main.ts so they can be unit-tested without DOM setup.
 */

export interface CustomPlantFormValues {
  name: string;
  spacingRaw: string;
}

/**
 * Validates the custom plant form inputs.
 *
 * Returns `null` when all inputs are valid.
 * Returns a human-readable error string for the first failing guard:
 *   1. Empty name
 *   2. Spacing out of bounds (non-numeric, < 0.10, or > 3.0)
 *   3. Name already used by an existing custom plant
 *      (pass `isNameAvail` from `isNameAvailable` in customPlants.ts)
 *   4. Name already exists in the Trefle plant database
 *      (pass `isKnownName` from `isKnownPlantName` in search.ts)
 *
 * @param values       Raw form field values.
 * @param editId       Id of the custom plant being edited, or undefined when adding new.
 * @param isNameAvail  Function that returns true when the name is free in the custom store.
 * @param isKnownName  Function that returns true when the name exists in the Trefle database.
 */
export function validateCustomPlantInput(
  values: CustomPlantFormValues,
  editId: string | undefined,
  isNameAvail: (name: string, excludeId?: string) => boolean,
  isKnownName: (name: string) => boolean,
): string | null {
  const name = values.name.trim();

  if (!name) {
    return 'Plant name is required.';
  }

  const spacing = parseFloat(values.spacingRaw);
  if (isNaN(spacing) || spacing < 0.1 || spacing > 3.0) {
    return 'Spacing must be between 0.10 and 3.0 m.';
  }

  if (!isNameAvail(name, editId)) {
    return `A custom plant named "${name}" already exists. Please use a different name.`;
  }

  if (isKnownName(name)) {
    return `"${name}" is already the name of a plant in the database. Please use a different name.`;
  }

  return null;
}
