import { describe, it, expect } from 'vitest';
import { summaryDisplayName, aggregatePlantCounts } from './summary';
import type { Plant, ShapeData } from './types';

function plant(overrides: Partial<Plant> = {}): Plant {
  return { name: 'Rose', spacing: 0.5, color: '#f48fb1', ...overrides };
}

function shapeWithMarkers(markers: Array<{ plant: Plant }>): ShapeData {
  return {
    type: 'rect',
    el: null as unknown as SVGGeometryElement,
    fill: '',
    stroke: '',
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    plantMarkers: markers.map((m) => ({
      plant: m.plant,
      x: 0,
      y: 0,
      el: null as unknown as SVGGElement,
    })),
  };
}

// ── D. Summary panel ──────────────────────────────────────────────────────────

describe('summaryDisplayName', () => {
  it('returns scientific_name when present (regression: was returning name)', () => {
    expect(summaryDisplayName(plant({ scientific_name: 'Rosa canina' }))).toBe('Rosa canina');
  });

  it('falls back to name when no scientific_name', () => {
    expect(summaryDisplayName(plant({ scientific_name: undefined }))).toBe('Rose');
  });
});

describe('aggregatePlantCounts', () => {
  it('returns empty map for shapes with no markers', () => {
    const result = aggregatePlantCounts([shapeWithMarkers([])]);
    expect(result.size).toBe(0);
  });

  it('counts markers correctly across a shape', () => {
    const p = plant({ slug: 'rosa-canina', scientific_name: 'Rosa canina' });
    const shape = shapeWithMarkers([{ plant: p }, { plant: p }, { plant: p }]);
    const result = aggregatePlantCounts([shape]);
    expect(result.size).toBe(1);
    expect(result.get('rosa-canina')?.count).toBe(3);
  });

  it('groups different plants separately', () => {
    const p1 = plant({ slug: 'rosa', name: 'Rose' });
    const p2 = plant({ slug: 'tulipa', name: 'Tulip', color: '#ff0' });
    const shape = shapeWithMarkers([{ plant: p1 }, { plant: p2 }, { plant: p1 }]);
    const result = aggregatePlantCounts([shape]);
    expect(result.size).toBe(2);
    expect(result.get('rosa')?.count).toBe(2);
    expect(result.get('tulipa')?.count).toBe(1);
  });
});
