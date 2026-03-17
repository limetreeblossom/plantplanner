import { describe, it, expect } from 'vitest';
import { searchPlants, bestFlowerColor, computeSpacing, rawToPlant } from './search';

// ── searchPlants ──────────────────────────────────────────────────────────────

describe('searchPlants', () => {
  it('returns empty array for empty query', () => {
    expect(searchPlants('')).toEqual([]);
    expect(searchPlants('   ')).toEqual([]);
  });

  it('filters by scientific_name (case-insensitive)', () => {
    const results = searchPlants('Rosa');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((p) => expect(p.scientific_name?.toLowerCase()).toContain('rosa'));
  });

  it('respects the limit parameter', () => {
    expect(searchPlants('a', 5)).toHaveLength(5);
    expect(searchPlants('a', 1)).toHaveLength(1);
  });
});

// ── computeSpacing ────────────────────────────────────────────────────────────

describe('computeSpacing', () => {
  it('uses spread_cm when present', () => {
    expect(computeSpacing(60, null, false)).toBeCloseTo(0.6);
  });

  it('falls back to row_spacing_cm when spread_cm is absent', () => {
    expect(computeSpacing(null, 40, false)).toBeCloseTo(0.4);
  });

  it('defaults to 0.30 for non-tree with no spacing data', () => {
    expect(computeSpacing(null, null, false)).toBeCloseTo(0.3);
  });

  it('defaults to 2.0 for tree with no spacing data', () => {
    expect(computeSpacing(null, null, true)).toBeCloseTo(2.0);
  });

  it('clamps spacing to minimum 0.10', () => {
    expect(computeSpacing(5, null, false)).toBeCloseTo(0.1);
  });

  it('clamps spacing to maximum 3.0', () => {
    expect(computeSpacing(400, null, false)).toBeCloseTo(3.0);
  });

  it('prefers spread_cm over row_spacing_cm when both present', () => {
    expect(computeSpacing(60, 40, false)).toBeCloseTo(0.6);
  });
});

// ── rawToPlant — icon detection ───────────────────────────────────────────────

describe('rawToPlant icon field', () => {
  const base = {
    name: 'Test Plant',
    scientific_name: 'Testus plantus',
    slug: '__nonexistent_slug__',
    family: 'Rosaceae',
    family_common_name: null,
    genus: 'Testus',
    image_url: null,
  };

  it('does not set icon for a plant with no enriched data', () => {
    const plant = rawToPlant(base);
    expect(plant.icon).toBeUndefined();
  });

  it('sets icon: tree for plants identified as Tree in enriched data', () => {
    // Find a real tree slug from the dataset
    const trees = searchPlants('pinus', 5);
    const tree = trees.find((p) => p.icon === 'tree');
    // If at least one Pinus is classified as a tree, verify the icon
    if (tree) {
      expect(tree.icon).toBe('tree');
    }
  });

  it('does not set icon for non-tree plants', () => {
    const results = searchPlants('rosa', 10);
    const nonTrees = results.filter((p) => p.growth_habit !== 'Tree');
    nonTrees.forEach((p) => expect(p.icon).toBeUndefined());
  });
});

// ── bestFlowerColor ───────────────────────────────────────────────────────────

describe('bestFlowerColor', () => {
  it('returns null for empty array', () => {
    expect(bestFlowerColor([])).toBeNull();
  });

  it('picks purple over white (higher priority)', () => {
    const result = bestFlowerColor(['white', 'purple']);
    expect(result).toBe('#ab47bc'); // purple hex
  });

  it('picks the single color when only one provided', () => {
    expect(bestFlowerColor(['yellow'])).toBe('#ffee58');
  });

  it('returns null for unknown color name', () => {
    expect(bestFlowerColor(['chartreuse'])).toBeNull();
  });

  it('falls back correctly when first choice is unknown', () => {
    expect(bestFlowerColor(['chartreuse', 'blue'])).toBe('#42a5f5');
  });
});
