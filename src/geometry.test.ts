import { describe, it, expect } from 'vitest';
import {
  SCALE, pxToM, fmt, calcArea, shapeCentroid, pointInShape, calcScale,
  calcPolygonArea, polygonCentroid, pointInPolygon, segmentsIntersect, polygonSelfIntersects,
  shapeBoundingBox, calcFillCount,
} from './geometry';
import type { RectShape, CircleShape, EllipseShape, PolygonShape } from './types';

// Minimal shape stubs — only the fields geometry functions use
const stubBase = {
  el: null as unknown as SVGGeometryElement,
  labelEl: null,
  fill: '',
  stroke: '',
  plantMarkers: [],
};

const rect: RectShape = {
  ...stubBase, type: 'rect',
  x: 0, y: 0, w: 300, h: 200, // 3 m × 2 m
};
const circle: CircleShape = {
  ...stubBase, type: 'circle',
  cx: 100, cy: 100, r: 100, // r = 1 m
};
const ellipse: EllipseShape = {
  ...stubBase, type: 'ellipse',
  cx: 200, cy: 150, rx: 200, ry: 100, // 4 m × 2 m
};

describe('SCALE', () => {
  it('is 100 px/m', () => expect(SCALE).toBe(100));
});

describe('pxToM', () => {
  it('converts 100 px → 1 m',  () => expect(pxToM(100)).toBe(1));
  it('converts 50 px → 0.5 m', () => expect(pxToM(50)).toBe(0.5));
  it('converts 0 px → 0 m',    () => expect(pxToM(0)).toBe(0));
});

describe('fmt', () => {
  it('rounds down correctly', () => expect(fmt(1.234)).toBe('1.23'));
  it('rounds up correctly',   () => expect(fmt(1.236)).toBe('1.24'));
  it('respects dp parameter', () => expect(fmt(1.2, 1)).toBe('1.2'));
  it('pads with zeros',       () => expect(fmt(1)).toBe('1.00'));
});

describe('calcArea', () => {
  it('rect: 3 m × 2 m = 6 m²', () => {
    expect(calcArea(rect)).toBeCloseTo(6, 5);
  });
  it('circle: r=1 m → π m²', () => {
    expect(calcArea(circle)).toBeCloseTo(Math.PI, 5);
  });
  it('ellipse: rx=2 m, ry=1 m → 2π m²', () => {
    expect(calcArea(ellipse)).toBeCloseTo(2 * Math.PI, 5);
  });
});

describe('shapeCentroid', () => {
  it('rect: centroid at (150, 100)', () => {
    expect(shapeCentroid(rect)).toEqual({ x: 150, y: 100 });
  });
  it('circle: centroid at (cx, cy)', () => {
    expect(shapeCentroid(circle)).toEqual({ x: 100, y: 100 });
  });
  it('ellipse: centroid at (cx, cy)', () => {
    expect(shapeCentroid(ellipse)).toEqual({ x: 200, y: 150 });
  });
});

describe('pointInShape — rect', () => {
  it('centre is inside',         () => expect(pointInShape(rect, 150, 100)).toBe(true));
  it('corner (0,0) is inside',   () => expect(pointInShape(rect, 0, 0)).toBe(true));
  it('far outside is false',     () => expect(pointInShape(rect, 400, 400)).toBe(false));
  it('just outside right edge',  () => expect(pointInShape(rect, 301, 100)).toBe(false));
  it('just outside bottom edge', () => expect(pointInShape(rect, 150, 201)).toBe(false));
});

describe('pointInShape — circle', () => {
  it('centre is inside',          () => expect(pointInShape(circle, 100, 100)).toBe(true));
  it('point on radius boundary',  () => expect(pointInShape(circle, 200, 100)).toBe(true));
  it('point just outside radius', () => expect(pointInShape(circle, 201, 100)).toBe(false));
  it('far outside is false',      () => expect(pointInShape(circle, 300, 300)).toBe(false));
});

describe('pointInShape — ellipse', () => {
  it('centre is inside',     () => expect(pointInShape(ellipse, 200, 150)).toBe(true));
  it('right vertex inside',  () => expect(pointInShape(ellipse, 400, 150)).toBe(true));
  it('just outside rx',      () => expect(pointInShape(ellipse, 401, 150)).toBe(false));
  it('top vertex inside',    () => expect(pointInShape(ellipse, 200, 250)).toBe(true));
  it('just outside ry',      () => expect(pointInShape(ellipse, 200, 251)).toBe(false));
  it('far outside is false', () => expect(pointInShape(ellipse, 500, 500)).toBe(false));
});

describe('calcScale', () => {
  it('100 px / 1 m → 100',             () => expect(calcScale(0, 0, 100, 0, 1)).toBeCloseTo(100, 5));
  it('200 px / 2 m → 100',             () => expect(calcScale(0, 0, 200, 0, 2)).toBeCloseTo(100, 5));
  it('150 px / 3 m → 50',              () => expect(calcScale(0, 0, 150, 0, 3)).toBeCloseTo(50, 5));
  it('3-4-5 triangle / 5 m → 1',       () => expect(calcScale(0, 0, 3, 4, 5)).toBeCloseTo(1, 5));
  it('realM ≤ 0 returns default SCALE', () => expect(calcScale(0, 0, 100, 0, 0)).toBe(SCALE));
});

describe('pxToM with custom scale', () => {
  it('100 px at scale 50 → 2 m',   () => expect(pxToM(100, 50)).toBe(2));
  it('100 px at scale 100 → 1 m',  () => expect(pxToM(100, 100)).toBe(1));
});

describe('calcArea with custom scale', () => {
  it('rect 300×200 px at scale 50 → 24 m²',  () => expect(calcArea(rect, 50)).toBeCloseTo(24, 5));
  it('rect 300×200 px at scale 100 → 6 m² (default)', () => expect(calcArea(rect)).toBeCloseTo(6, 5));
});

// ── Polygon pure functions ────────────────────────────────────────────────

const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

describe('calcPolygonArea', () => {
  it('100×100 px square at scale 100 → 1 m²',
    () => expect(calcPolygonArea(square)).toBeCloseTo(1, 5));
  it('100×100 px square at scale 50  → 4 m²',
    () => expect(calcPolygonArea(square, 50)).toBeCloseTo(4, 5));
  it('right triangle base=100 h=100 at scale 100 → 0.5 m²',
    () => expect(calcPolygonArea([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }])).toBeCloseTo(0.5, 5));
  it('< 3 points → 0',
    () => expect(calcPolygonArea([{ x: 0, y: 0 }, { x: 100, y: 0 }])).toBe(0));
});

describe('polygonCentroid', () => {
  it('square centroid = (50, 50)', () => {
    const c = polygonCentroid(square);
    expect(c.x).toBeCloseTo(50); expect(c.y).toBeCloseTo(50);
  });
  it('empty array → (0, 0)', () => expect(polygonCentroid([])).toEqual({ x: 0, y: 0 }));
});

describe('pointInPolygon', () => {
  it('centre of square is inside',  () => expect(pointInPolygon(square, 50, 50)).toBe(true));
  it('far outside square is false', () => expect(pointInPolygon(square, 150, 50)).toBe(false));
  it('point clearly outside on negative x is false',
    () => expect(pointInPolygon(square, -1, 50)).toBe(false));
});

describe('segmentsIntersect', () => {
  it('crossing diagonals intersect',
    () => expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 })).toBe(true));
  it('parallel horizontal segments do not intersect',
    () => expect(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 })).toBe(false));
  it('shared endpoint is not counted as interior intersection',
    () => expect(segmentsIntersect({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 5, y: 5 }, { x: 10, y: 0 })).toBe(false));
});

describe('polygonSelfIntersects', () => {
  it('convex square does not self-intersect',
    () => expect(polygonSelfIntersects(square)).toBe(false));
  it('triangle (n < 4) does not self-intersect',
    () => expect(polygonSelfIntersects([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }])).toBe(false));
  it('bowtie (figure-eight) self-intersects',
    () => expect(polygonSelfIntersects([{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }])).toBe(true));
});

// ── shapeBoundingBox ────────────────────────────────────────────────────────

describe('shapeBoundingBox', () => {
  const base = { el: null as unknown as SVGGeometryElement, labelEl: null, fill: '', stroke: '', plantMarkers: [] };

  it('rect: returns x/y/w/h directly', () => {
    const r: RectShape = { ...base, type: 'rect', x: 10, y: 20, w: 150, h: 80 };
    expect(shapeBoundingBox(r)).toEqual({ x: 10, y: 20, w: 150, h: 80 });
  });

  it('circle: bbox is square centred on cx/cy with side 2r', () => {
    const c: CircleShape = { ...base, type: 'circle', cx: 100, cy: 100, r: 40 };
    expect(shapeBoundingBox(c)).toEqual({ x: 60, y: 60, w: 80, h: 80 });
  });

  it('ellipse: bbox uses rx/ry', () => {
    const e: EllipseShape = { ...base, type: 'ellipse', cx: 200, cy: 150, rx: 60, ry: 30 };
    expect(shapeBoundingBox(e)).toEqual({ x: 140, y: 120, w: 120, h: 60 });
  });

  it('polygon: tight bbox around all vertices', () => {
    const p: PolygonShape = {
      ...base, type: 'polygon',
      points: [{ x: 10, y: 50 }, { x: 90, y: 10 }, { x: 150, y: 80 }, { x: 60, y: 120 }],
    };
    expect(shapeBoundingBox(p)).toEqual({ x: 10, y: 10, w: 140, h: 110 });
  });
});

// ── calcFillCount ───────────────────────────────────────────────────────────

describe('calcFillCount', () => {
  it('fills a 10 m² bed with 0.5 m spacing and no existing markers', () => {
    // cell = 0.25 m², ceil(10/0.25) = 40
    expect(calcFillCount(10, 0, 0.5)).toBe(40);
  });

  it('deducts existing markers from available area', () => {
    // used = 5 * 0.25 = 1.25 m², available = 8.75, ceil(8.75/0.25) = 35
    expect(calcFillCount(10, 5, 0.5)).toBe(35);
  });

  it('returns 0 when existing markers exactly fill the area', () => {
    // 40 markers * 0.25 m² = 10 m² → available = 0
    expect(calcFillCount(10, 40, 0.5)).toBe(0);
  });

  it('returns 0 when existing markers exceed the area', () => {
    expect(calcFillCount(10, 50, 0.5)).toBe(0);
  });

  it('uses ceiling — partial cell rounds up', () => {
    // area = 1.1 m², spacing = 1.0 m, cell = 1 m², ceil(1.1/1) = 2
    expect(calcFillCount(1.1, 0, 1.0)).toBe(2);
  });

  it('returns 0 for zero area', () => {
    expect(calcFillCount(0, 0, 0.5)).toBe(0);
  });

  it('returns 0 for zero spacing', () => {
    expect(calcFillCount(10, 0, 0)).toBe(0);
  });

  it('returns 1 for area equal to one cell', () => {
    expect(calcFillCount(1, 0, 1.0)).toBe(1);
  });
});
