import { describe, it, expect } from 'vitest';
import { SCALE, CANVAS_W, calcZoomLimits, rulerTicks } from './geometry';

// ── calcZoomLimits ────────────────────────────────────────────────────────

describe('calcZoomLimits', () => {
  it('at default scale, default vbW sits within bounds', () => {
    const { minVbW, maxVbW } = calcZoomLimits(SCALE);
    expect(CANVAS_W).toBeGreaterThan(minVbW);
    expect(CANVAS_W).toBeLessThan(maxVbW);
  });

  it('limits scale proportionally with sessionScale', () => {
    const base = calcZoomLimits(SCALE);
    const scaled = calcZoomLimits(SCALE * 5);
    expect(scaled.minVbW).toBeCloseTo(base.minVbW * 5);
    expect(scaled.maxVbW).toBeCloseTo(base.maxVbW * 5);
  });

  it('after calibration to coarser scale, maxVbW still encompasses the full canvas', () => {
    // sessionScale 500 px/m: 9 m needs vbW = 9 * 500 = 4500 SVG units
    const { maxVbW } = calcZoomLimits(500);
    expect(maxVbW).toBeGreaterThan(9 * 500);
  });

  it('after calibration to finer scale, minVbW stays proportionally small', () => {
    const { minVbW } = calcZoomLimits(20);
    expect(minVbW).toBeCloseTo(CANVAS_W * 0.1 * (20 / SCALE));
  });
});

// ── rulerTicks ────────────────────────────────────────────────────────────

describe('rulerTicks', () => {
  // vbStart=0, vbSpan=900 (default view), ruler canvas 900px wide, sessionScale=100
  const defaultTicks = () => rulerTicks(0, 900, 900, SCALE);

  it('generates a tick at 0 m when vbStart is 0', () => {
    const ticks = defaultTicks();
    const zero = ticks.find((t) => t.m === 0);
    expect(zero).toBeDefined();
    expect(zero!.pos).toBeCloseTo(0);
  });

  it('suppresses the label at pos 0 (hidden under corner square)', () => {
    const ticks = defaultTicks();
    const zero = ticks.find((t) => t.m === 0)!;
    expect(zero.showLabel).toBe(false);
  });

  it('shows labels for ticks well away from the edge', () => {
    const ticks = defaultTicks();
    const one = ticks.find((t) => t.m === 1)!;
    expect(one.showLabel).toBe(true);
    expect(one.pos).toBeGreaterThan(8);
  });

  it('tick positions are evenly spaced by sessionScale/vbSpan*length', () => {
    const ticks = defaultTicks();
    const step = ticks[1].pos - ticks[0].pos;
    for (let i = 2; i < ticks.length; i++) {
      expect(ticks[i].pos - ticks[i - 1].pos).toBeCloseTo(step);
    }
  });

  it('uses labelStep=10 when very zoomed out (pxPerM < 20)', () => {
    // vbSpan=9000 over 900px canvas → pxPerM = (100/9000)*900 = 10
    const ticks = rulerTicks(0, 9000, 900, SCALE);
    const labeled = ticks.filter((t) => t.showLabel);
    expect(labeled.every((t) => t.m % 10 === 0)).toBe(true);
  });

  it('covers the full span from firstM to lastM', () => {
    const ticks = rulerTicks(0, 900, 900, SCALE); // 0..9 m
    expect(ticks[0].m).toBe(0);
    expect(ticks[ticks.length - 1].m).toBe(9);
  });
});
