import type { ShapeData } from './types';

export const SCALE    = 100; // pixels per metre
export const CANVAS_W = 900;
export const CANVAS_H = 600;

export function pxToM(px: number, scale = SCALE): number {
  return px / scale;
}

export function fmt(m: number, dp = 2): string {
  return m.toFixed(dp);
}

export function calcPolygonArea(
  points: Array<{ x: number; y: number }>,
  scale = SCALE
): number {
  const n = points.length;
  if (n < 3) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(sum) / 2 / (scale * scale);
}

export function polygonCentroid(
  points: Array<{ x: number; y: number }>
): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
}

export function pointInPolygon(
  points: Array<{ x: number; y: number }>,
  x: number,
  y: number
): boolean {
  const n = points.length;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const { x: xi, y: yi } = points[i];
    const { x: xj, y: yj } = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

export function segmentsIntersect(
  p1: { x: number; y: number }, p2: { x: number; y: number },
  p3: { x: number; y: number }, p4: { x: number; y: number }
): boolean {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-10) return false; // parallel / collinear
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / cross;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / cross;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

export function polygonSelfIntersects(
  points: Array<{ x: number; y: number }>
): boolean {
  const n = points.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n;
    for (let j = i + 2; j < n; j++) {
      const j2 = (j + 1) % n;
      if (j2 === i) continue; // adjacent segments share an endpoint — skip
      if (segmentsIntersect(points[i], points[i2], points[j], points[j2])) return true;
    }
  }
  return false;
}

export function calcArea(d: ShapeData, scale = SCALE): number {
  if (d.type === 'rect')    return pxToM(d.w, scale) * pxToM(d.h, scale);
  if (d.type === 'circle')  return Math.PI * pxToM(d.r, scale) ** 2;
  if (d.type === 'ellipse') return Math.PI * pxToM(d.rx, scale) * pxToM(d.ry, scale);
  if (d.type === 'polygon') return calcPolygonArea(d.points, scale);
  return 0;
}

export function calcScale(x1: number, y1: number, x2: number, y2: number, realM: number): number {
  if (realM <= 0) return SCALE;
  const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  return dist / realM;
}

export function shapeCentroid(d: ShapeData): { x: number; y: number } {
  if (d.type === 'rect')    return { x: d.x + d.w / 2, y: d.y + d.h / 2 };
  if (d.type === 'circle')  return { x: d.cx, y: d.cy };
  if (d.type === 'polygon') return polygonCentroid(d.points);
  return { x: d.cx, y: d.cy }; // ellipse
}

export function pointInRect(d: ShapeData & { type: 'rect' }, x: number, y: number): boolean {
  return x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h;
}

export function pointInCircle(d: ShapeData & { type: 'circle' }, x: number, y: number): boolean {
  const dx = x - d.cx, dy = y - d.cy;
  return dx * dx + dy * dy <= d.r * d.r;
}

export function pointInEllipse(d: ShapeData & { type: 'ellipse' }, x: number, y: number): boolean {
  const dx = (x - d.cx) / d.rx;
  const dy = (y - d.cy) / d.ry;
  return dx * dx + dy * dy <= 1;
}

export function shapeBoundingBox(d: ShapeData): { x: number; y: number; w: number; h: number } {
  if (d.type === 'rect')    return { x: d.x, y: d.y, w: d.w, h: d.h };
  if (d.type === 'circle')  return { x: d.cx - d.r,  y: d.cy - d.r,  w: 2 * d.r,  h: 2 * d.r  };
  if (d.type === 'ellipse') return { x: d.cx - d.rx, y: d.cy - d.ry, w: 2 * d.rx, h: 2 * d.ry };
  // polygon
  const xs = d.points.map(p => p.x);
  const ys = d.points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Estimated number of plants needed to fill the available area.
 * Uses ceiling so the count slightly over-estimates rather than under-estimates.
 * existingMarkers reduces the available area (square-grid cell per marker).
 */
export function calcFillCount(shapeAreaM2: number, existingMarkers: number, spacingM: number): number {
  if (spacingM <= 0) return 0;
  const cellArea  = spacingM * spacingM;
  const available = Math.max(0, shapeAreaM2 - existingMarkers * cellArea);
  if (available === 0) return 0;
  return Math.ceil(available / cellArea);
}

export function pointInShape(d: ShapeData, x: number, y: number): boolean {
  if (d.type === 'rect')    return pointInRect(d, x, y);
  if (d.type === 'circle')  return pointInCircle(d, x, y);
  if (d.type === 'ellipse') return pointInEllipse(d, x, y);
  if (d.type === 'polygon') return pointInPolygon(d.points, x, y);
  return false;
}
