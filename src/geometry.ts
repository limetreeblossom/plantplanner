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

export function calcArea(d: ShapeData, scale = SCALE): number {
  if (d.type === 'rect')    return pxToM(d.w, scale) * pxToM(d.h, scale);
  if (d.type === 'circle')  return Math.PI * pxToM(d.r, scale) ** 2;
  if (d.type === 'ellipse') return Math.PI * pxToM(d.rx, scale) * pxToM(d.ry, scale);
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

export function pointInShape(d: ShapeData, x: number, y: number): boolean {
  if (d.type === 'rect')    return pointInRect(d, x, y);
  if (d.type === 'circle')  return pointInCircle(d, x, y);
  if (d.type === 'ellipse') return pointInEllipse(d, x, y);
  return false;
}
