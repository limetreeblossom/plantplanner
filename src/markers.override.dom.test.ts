// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { buildMarkerEl, applyOverrideToEl } from './markers';
import type { Plant } from './types';

function flowerPlant(overrides: Partial<Plant> = {}): Plant {
  return { name: 'Rose', spacing: 0.5, color: '#f48fb1', ...overrides };
}

function treePlant(overrides: Partial<Plant> = {}): Plant {
  return { name: 'Oak', spacing: 2.0, color: '#2e7d32', icon: 'tree' as const, ...overrides };
}

// ── F. Plant override ─────────────────────────────────────────────────────────

describe('applyOverrideToEl', () => {
  it('updates spacing-ring radius to (spacing / 2) * scale', () => {
    const el = buildMarkerEl(flowerPlant({ spacing: 0.5 }), 100, 100, 100);
    applyOverrideToEl(el, 1.0, '#f48fb1', 100);
    const ring = el.querySelector<SVGCircleElement>('.spacing-ring');
    expect(ring?.getAttribute('r')).toBe('50'); // (1.0 / 2) * 100
  });

  it('updates petal-fill colors on flower markers', () => {
    const el = buildMarkerEl(flowerPlant({ color: '#f48fb1' }), 100, 100, 100);
    applyOverrideToEl(el, 0.5, '#ce93d8', 100);
    const petals = el.querySelectorAll('.petal-fill');
    expect(petals.length).toBeGreaterThan(0);
    petals.forEach((p) => expect(p.getAttribute('fill')).toBe('#ce93d8'));
  });

  it('tree markers have no petal-fill elements affected', () => {
    const el = buildMarkerEl(treePlant(), 100, 100, 100);
    applyOverrideToEl(el, 2.0, '#ff0000', 100);
    const petals = el.querySelectorAll('.petal-fill');
    expect(petals.length).toBe(0);
    // tree icon transform should be updated
    const treeG = el.querySelector('.tree-icon');
    expect(treeG?.getAttribute('transform')).toContain('translate(100,100)');
  });
});
