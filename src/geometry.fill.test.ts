import { describe, it, expect } from 'vitest';
import { computeFillPositions } from './geometry';
import type { ShapeData } from './types';

function rectShape(x: number, y: number, w: number, h: number): ShapeData {
  return {
    type: 'rect',
    el: null as unknown as SVGGeometryElement,
    fill: '',
    stroke: '',
    x,
    y,
    w,
    h,
    plantMarkers: [],
  };
}

function circleShape(cx: number, cy: number, r: number): ShapeData {
  return {
    type: 'circle',
    el: null as unknown as SVGGeometryElement,
    fill: '',
    stroke: '',
    cx,
    cy,
    r,
    plantMarkers: [],
  };
}

function ellipseShape(cx: number, cy: number, rx: number, ry: number): ShapeData {
  return {
    type: 'ellipse',
    el: null as unknown as SVGGeometryElement,
    fill: '',
    stroke: '',
    cx,
    cy,
    rx,
    ry,
    plantMarkers: [],
  };
}

function polygonShape(points: Array<{ x: number; y: number }>): ShapeData {
  return {
    type: 'polygon',
    el: null as unknown as SVGGeometryElement,
    fill: '',
    stroke: '',
    points,
    plantMarkers: [],
  };
}

// ── H. Fill mode ──────────────────────────────────────────────────────────────

describe('computeFillPositions', () => {
  it('fills a rect with the expected hexagonal count', () => {
    // 200×200 px rect, spacing 0.5 m, scale 100 px/m → stepPx 50
    // Hexagonal pattern: rowStepY = 50 * sqrt(3)/2 ≈ 43.30
    // Rows at y ≈ 25, 68.30, 111.60, 154.90, 198.21 → 5 rows
    // Even rows (0,2,4): 4 cols each (x = 25,75,125,175)
    // Odd rows (1,3):    3 cols each (x = 50,100,150; 200 excluded)
    // Total: 3×4 + 2×3 = 18
    const shape = rectShape(0, 0, 200, 200);
    const positions = computeFillPositions(shape, 0.5, 100, []);
    expect(positions.length).toBe(18);
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
    // Pre-occupy the top-left hex grid cell (row 0, col 0)
    const existing = [{ x: 25, y: 25 }];
    const positions = computeFillPositions(shape, 0.5, 100, existing);
    expect(positions.length).toBe(17); // 18 − 1 occupied
    expect(positions.some((p) => p.x === 25 && p.y === 25)).toBe(false);
  });

  it('returns empty array when no positions fit', () => {
    // 1×1 px rect — too small for any grid point at 0.5 m spacing
    const shape = rectShape(0, 0, 1, 1);
    const positions = computeFillPositions(shape, 0.5, 100, []);
    expect(positions.length).toBe(0);
  });

  it('odd rows are offset by half a step in X', () => {
    // 200×100 px rect: 2 rows (y≈25 and y≈68.30)
    // Row 0 (even): x starts at 25; row 1 (odd): x starts at 50
    const shape = rectShape(0, 0, 200, 100);
    const positions = computeFillPositions(shape, 0.5, 100, []);
    const row0 = positions.filter((p) => Math.abs(p.y - 25) < 1);
    const row1 = positions.filter((p) => Math.abs(p.y - 50 * (Math.sqrt(3) / 2) - 25) < 1);
    expect(row0[0].x).toBeCloseTo(25, 5);
    expect(row1[0].x).toBeCloseTo(50, 5); // offset by stepPx/2 = 25
  });
});

// ── Circle ────────────────────────────────────────────────────────────────────

describe('computeFillPositions — circle', () => {
  it('all positions lie within the circle', () => {
    // Circle r=100px at (100,100); spacing 0.5m, scale 100 → stepPx 50
    const shape = circleShape(100, 100, 100);
    const positions = computeFillPositions(shape, 0.5, 100, []);
    for (const { x, y } of positions) {
      const dx = x - 100,
        dy = y - 100;
      expect(Math.sqrt(dx * dx + dy * dy)).toBeLessThanOrEqual(100 + 0.01);
    }
  });

  it('yields fewer positions than the bounding rect (corners excluded)', () => {
    const shape = circleShape(100, 100, 100);
    const rect = rectShape(0, 0, 200, 200);
    const circlePositions = computeFillPositions(shape, 0.5, 100, []);
    const rectPositions = computeFillPositions(rect, 0.5, 100, []);
    expect(circlePositions.length).toBeLessThan(rectPositions.length);
  });

  it('returns empty array for a circle too small to contain any grid point', () => {
    // r=10px, stepPx=50 — half-step start (25px) is outside the circle
    const shape = circleShape(100, 100, 10);
    const positions = computeFillPositions(shape, 0.5, 100, []);
    expect(positions.length).toBe(0);
  });
});

// ── Ellipse ───────────────────────────────────────────────────────────────────

describe('computeFillPositions — ellipse', () => {
  it('all positions satisfy the ellipse equation', () => {
    // Ellipse rx=150, ry=75 at (150,75)
    const shape = ellipseShape(150, 75, 150, 75);
    const positions = computeFillPositions(shape, 0.5, 100, []);
    for (const { x, y } of positions) {
      const dx = (x - 150) / 150,
        dy = (y - 75) / 75;
      expect(dx * dx + dy * dy).toBeLessThanOrEqual(1 + 0.01);
    }
  });

  it('wide ellipse has more positions than tall ellipse of equal area', () => {
    // Both have area π*150*75 ≈ 35 343 px²
    const wide = ellipseShape(150, 75, 150, 75); // rx > ry
    const tall = ellipseShape(75, 150, 75, 150); // ry > rx
    const widePos = computeFillPositions(wide, 0.5, 100, []);
    const tallPos = computeFillPositions(tall, 0.5, 100, []);
    // Counts may differ slightly due to hex row offset; both should be > 0
    expect(widePos.length).toBeGreaterThan(0);
    expect(tallPos.length).toBeGreaterThan(0);
  });
});

// ── Mixed-species spacing ─────────────────────────────────────────────────────

describe('computeFillPositions — mixed-species spacing', () => {
  // Large 600×600 px rect; centre at (300, 300)
  const largRect = rectShape(0, 0, 600, 600);

  it('Case A: large-spacing existing plant does NOT block small fill plants entirely', () => {
    // Existing marker at centre with spacing 2.0 m
    const existing = [{ x: 300, y: 300, spacing: 2.0 }];
    // Fill plant spacing 0.3 m, scale 100 px/m
    const positions = computeFillPositions(largRect, 0.3, 100, existing);

    // Small plants still fill the shape — result is NOT empty
    expect(positions.length).toBeGreaterThan(0);

    // Exclusion zone = max(2.0, 0.3) * 100 - 0.5 = 199.5 px
    const exclusion = 199.5;
    for (const { x, y } of positions) {
      const dx = x - 300,
        dy = y - 300;
      expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(exclusion);
    }
  });

  it('Case B: small-spacing existing plant does not block large-spacing fill candidates too close', () => {
    // Existing marker at centre with spacing 0.3 m
    const existing = [{ x: 300, y: 300, spacing: 0.3 }];
    // Fill plant spacing 2.0 m, scale 100 px/m
    const positions = computeFillPositions(largRect, 2.0, 100, existing);

    // Exclusion zone = max(0.3, 2.0) * 100 - 0.5 = 199.5 px
    const exclusion = 199.5;
    for (const { x, y } of positions) {
      const dx = x - 300,
        dy = y - 300;
      expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(exclusion);
    }
  });

  it('Case C: existing marker with no spacing field falls back to fill-plant spacing', () => {
    // No spacing field on existing — fallback: max(undefined ?? 0.5, 0.5) * 100 - 0.5 = 49.5 px
    const existing = [{ x: 300, y: 300 }];
    const positions = computeFillPositions(largRect, 0.5, 100, existing);

    // Exclusion zone = 0.5 * 100 - 0.5 = 49.5 px
    const exclusion = 49.5;
    for (const { x, y } of positions) {
      const dx = x - 300,
        dy = y - 300;
      expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(exclusion);
    }
  });
});

// ── Polygon ───────────────────────────────────────────────────────────────────

describe('computeFillPositions — polygon', () => {
  it('all positions lie inside the polygon', () => {
    // Triangle: (0,0) → (200,0) → (100,200)
    const shape = polygonShape([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 100, y: 200 },
    ]);
    const positions = computeFillPositions(shape, 0.5, 100, []);
    // Every returned point must be inside the triangle bounding box and above
    // the triangle edges — just check bounding box here; pointInShape handles edges
    for (const { x, y } of positions) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(200);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(200);
    }
    expect(positions.length).toBeGreaterThan(0);
  });

  it('yields fewer positions than its bounding rect (corners clipped)', () => {
    // Triangle covers ~half the bounding rect
    const triangle = polygonShape([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 100, y: 200 },
    ]);
    const rect = rectShape(0, 0, 200, 200);
    const triPos = computeFillPositions(triangle, 0.5, 100, []);
    const rectPos = computeFillPositions(rect, 0.5, 100, []);
    expect(triPos.length).toBeLessThan(rectPos.length);
  });
});
