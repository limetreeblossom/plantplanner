import { describe, it, expect } from 'vitest';
import { buildExportRows } from './export';
import type { Plant, ShapeData } from './types';

function plant(overrides: Partial<Plant> = {}): Plant {
  return { name: 'Rose', spacing: 0.5, color: '#f48fb1', ...overrides };
}

function shapeWithMarkers(markers: Plant[]): ShapeData {
  return {
    type: 'rect',
    el: null as unknown as SVGGeometryElement,
    fill: '',
    stroke: '',
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    plantMarkers: markers.map((p) => ({
      plant: p,
      x: 0,
      y: 0,
      el: null as unknown as SVGGElement,
    })),
  };
}

// ── G. Excel export ───────────────────────────────────────────────────────────

describe('buildExportRows', () => {
  it('uses scientific_name when available', () => {
    const rows = buildExportRows([
      shapeWithMarkers([plant({ name: 'Rose', scientific_name: 'Rosa canina', spacing: 0.5 })]),
    ]);
    expect(rows[0]).toEqual(['Plant', 'Spacing (m)', 'Count']);
    expect(rows[1]).toEqual(['Rosa canina', 0.5, 1]);
  });

  it('falls back to name when scientific_name is absent', () => {
    const rows = buildExportRows([shapeWithMarkers([plant({ name: 'Rose', spacing: 0.5 })])]);
    expect(rows[1]).toEqual(['Rose', 0.5, 1]);
  });

  it('last row is the grand total', () => {
    const rows = buildExportRows([
      shapeWithMarkers([
        plant({ name: 'Rose' }),
        plant({ name: 'Rose' }),
        plant({ name: 'Tulip' }),
      ]),
    ]);
    const last = rows[rows.length - 1];
    expect(last[0]).toBe('Total');
    expect(last[2]).toBe(3);
  });

  it('aggregates the same plant across multiple shapes', () => {
    const p = plant({ name: 'Rose', spacing: 0.5 });
    const rows = buildExportRows([shapeWithMarkers([p]), shapeWithMarkers([p, p])]);
    const roseRow = rows.find((r) => r[0] === 'Rose');
    expect(roseRow?.[2]).toBe(3);
  });

  it('uses plant.name (not scientific_name) for custom plants', () => {
    const p = plant({ name: 'My Rose', scientific_name: 'Rosa canina', isCustom: true });
    const rows = buildExportRows([shapeWithMarkers([p])]);
    expect(rows[1][0]).toBe('My Rose');
  });

  it('still uses scientific_name for non-custom plants', () => {
    const p = plant({ name: 'Rose', scientific_name: 'Rosa canina', isCustom: false });
    const rows = buildExportRows([shapeWithMarkers([p])]);
    expect(rows[1][0]).toBe('Rosa canina');
  });
});
