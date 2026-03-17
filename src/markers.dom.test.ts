// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  buildMarkerEl,
  createFlowerMarker,
  createTreeMarker,
  showMarkerSelection,
  hideMarkerSelection,
} from './markers';
import type { Plant } from './types';

const SCALE = 100;

function flowerPlant(overrides: Partial<Plant> = {}): Plant {
  return { name: 'Rose', spacing: 0.5, color: '#f48fb1', ...overrides };
}

function treePlant(overrides: Partial<Plant> = {}): Plant {
  return { name: 'Oak', spacing: 2.0, color: '#2e7d32', icon: 'tree' as const, ...overrides };
}

// ── B. Marker construction ────────────────────────────────────────────────────

describe('buildMarkerEl', () => {
  it('returns a <g> SVG element', () => {
    const g = buildMarkerEl(flowerPlant(), 100, 100, SCALE);
    expect(g.tagName).toBe('g');
  });

  it('contains a spacing ring with #2e7d32 stroke', () => {
    const g = buildMarkerEl(flowerPlant(), 100, 100, SCALE);
    const ring = g.querySelector('.spacing-ring');
    expect(ring).not.toBeNull();
    expect(ring!.getAttribute('stroke')).toBe('#2e7d32');
  });

  it('spacing ring stroke is #2e7d32 regardless of plant color', () => {
    const g = buildMarkerEl(flowerPlant({ color: '#ff0000' }), 100, 100, SCALE);
    const ring = g.querySelector('.spacing-ring');
    expect(ring!.getAttribute('stroke')).toBe('#2e7d32');
  });

  it('contains a sel-circle hidden by default', () => {
    const g = buildMarkerEl(flowerPlant(), 100, 100, SCALE);
    const sel = g.querySelector('.sel-circle') as HTMLElement | null;
    expect(sel).not.toBeNull();
    expect(sel!.style.display).toBe('none');
  });

  it('tree plant produces icon group with class tree-icon', () => {
    const g = buildMarkerEl(treePlant(), 100, 100, SCALE);
    expect(g.querySelector('.tree-icon')).not.toBeNull();
    expect(g.querySelector('.flower-icon')).toBeNull();
  });

  it('non-tree plant produces icon group with class flower-icon', () => {
    const g = buildMarkerEl(flowerPlant(), 100, 100, SCALE);
    expect(g.querySelector('.flower-icon')).not.toBeNull();
    expect(g.querySelector('.tree-icon')).toBeNull();
  });
});

describe('showMarkerSelection / hideMarkerSelection', () => {
  it('showMarkerSelection makes sel-circle visible', () => {
    const g = buildMarkerEl(flowerPlant(), 100, 100, SCALE);
    showMarkerSelection(g);
    const sel = g.querySelector<HTMLElement>('.sel-circle');
    expect(sel!.style.display).toBe('');
  });

  it('hideMarkerSelection hides sel-circle again', () => {
    const g = buildMarkerEl(flowerPlant(), 100, 100, SCALE);
    showMarkerSelection(g);
    hideMarkerSelection(g);
    const sel = g.querySelector<HTMLElement>('.sel-circle');
    expect(sel!.style.display).toBe('none');
  });
});

// ── Icon builders ─────────────────────────────────────────────────────────────

describe('createFlowerMarker', () => {
  it('returns a <g> with class flower-icon', () => {
    const g = createFlowerMarker(0, 0, 20, '#f48fb1');
    expect(g.classList.contains('flower-icon')).toBe(true);
  });

  it('contains petal paths with class petal-fill', () => {
    const g = createFlowerMarker(0, 0, 20, '#f48fb1');
    const petals = g.querySelectorAll('.petal-fill');
    expect(petals.length).toBeGreaterThan(0);
  });

  it('petals use the provided color', () => {
    const color = '#ab47bc';
    const g = createFlowerMarker(0, 0, 20, color);
    const petal = g.querySelector('.petal-fill');
    expect(petal!.getAttribute('fill')).toBe(color);
  });
});

describe('createTreeMarker', () => {
  it('returns a <g> with class tree-icon', () => {
    const g = createTreeMarker(0, 0, 20);
    expect(g.classList.contains('tree-icon')).toBe(true);
  });

  it('tree body is always dark green (#2e7d32)', () => {
    const g = createTreeMarker(0, 0, 20);
    const paths = g.querySelectorAll('path');
    const body = Array.from(paths).find((p) => p.getAttribute('fill') === '#2e7d32');
    expect(body).not.toBeUndefined();
  });
});
