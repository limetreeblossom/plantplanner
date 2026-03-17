import { describe, it, expect } from 'vitest';
import { computeFillPositions } from './geometry';
import type { ShapeData } from './types';

function rectShape(x: number, y: number, w: number, h: number): ShapeData {
  return {
    type: 'rect',
    el: null as unknown as SVGGeometryElement,
    labelEl: null,
    fill: '',
    stroke: '',
    x,
    y,
    w,
    h,
    plantMarkers: [],
  };
}

// ── H. Fill mode ──────────────────────────────────────────────────────────────

describe('computeFillPositions', () => {
  it('fills a rect with the expected grid count', () => {
    // 200×200 px rect, spacing 0.5 m, scale 100 px/m → stepPx 50
    // grid: 4 cols × 4 rows = 16 positions
    const shape = rectShape(0, 0, 200, 200);
    const positions = computeFillPositions(shape, 0.5, 100, []);
    expect(positions.length).toBe(16);
  });

  it('all returned positions lie within the shape bounding box', () => {
    const shape = rectShape(50, 50, 200, 200);
    const positions = computeFillPositions(shape, 0.5, 100, []);
    for (const { x, y } of positions) {
      expect(x).toBeGreaterThanOrEqual(50);
      expect(x).toBeLessThanOrEqual(250);
      expect(y).toBeGreaterThanOrEqual(50);
      expect(y).toBeLessThanOrEqual(250);
    }
  });

  it('excludes positions too close to existing markers', () => {
    const shape = rectShape(0, 0, 200, 200);
    // Pre-occupy the top-left grid cell centre
    const existing = [{ x: 25, y: 25 }];
    const positions = computeFillPositions(shape, 0.5, 100, existing);
    expect(positions.length).toBe(15); // 16 − 1 occupied
    expect(positions.some((p) => p.x === 25 && p.y === 25)).toBe(false);
  });

  it('returns empty array when no positions fit', () => {
    // 1×1 px rect — too small for any grid point at 0.5 m spacing
    const shape = rectShape(0, 0, 1, 1);
    const positions = computeFillPositions(shape, 0.5, 100, []);
    expect(positions.length).toBe(0);
  });
});
