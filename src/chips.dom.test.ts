// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { makeChipIcon, buildChipEl } from './chips';
import type { Plant } from './types';

function flowerPlant(overrides: Partial<Plant> = {}): Plant {
  return {
    name: 'Rose',
    spacing: 0.5,
    color: '#f48fb1',
    scientific_name: 'Rosa canina',
    ...overrides,
  };
}

function treePlant(overrides: Partial<Plant> = {}): Plant {
  return {
    name: 'Oak',
    spacing: 2.0,
    color: '#2e7d32',
    icon: 'tree' as const,
    scientific_name: 'Quercus robur',
    ...overrides,
  };
}

// ── C. Chip construction ──────────────────────────────────────────────────────

describe('buildChipEl', () => {
  it('displays scientific_name as primary label when present', () => {
    const chip = buildChipEl(flowerPlant(), flowerPlant());
    const nameSpan = chip.querySelector('.chip-name');
    expect(nameSpan?.textContent).toBe('Rosa canina');
  });

  it('falls back to name when no scientific_name', () => {
    const plant = flowerPlant({ scientific_name: undefined });
    const chip = buildChipEl(plant, plant);
    const nameSpan = chip.querySelector('.chip-name');
    expect(nameSpan?.textContent).toBe('Rose');
  });

  it('contains an SVG icon element', () => {
    const chip = buildChipEl(flowerPlant(), flowerPlant());
    const svg = chip.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('tree plant chip contains tree-icon SVG paths (dark green body)', () => {
    const plant = treePlant();
    const chip = buildChipEl(plant, plant);
    const svg = chip.querySelector('svg');
    const paths = svg ? Array.from(svg.querySelectorAll('path')) : [];
    const hasGreenBody = paths.some((p) => p.getAttribute('fill') === '#2e7d32');
    expect(hasGreenBody).toBe(true);
  });

  it('non-tree chip contains petal paths with class chip-petal', () => {
    const plant = flowerPlant();
    const chip = buildChipEl(plant, plant);
    const petals = chip.querySelectorAll('.chip-petal');
    expect(petals.length).toBeGreaterThan(0);
  });

  it('custom plant shows name (not scientific_name) even when scientific_name is set', () => {
    const p: Plant = {
      name: 'My Rose',
      spacing: 0.5,
      color: '#f48fb1',
      scientific_name: 'Rosa canina',
      isCustom: true,
    };
    const chip = buildChipEl(p, p);
    const nameSpan = chip.querySelector('.chip-name');
    expect(nameSpan?.textContent).toBe('My Rose');
  });

  it('non-custom plant with scientific_name still shows scientific_name', () => {
    const p = flowerPlant({ isCustom: false });
    const chip = buildChipEl(p, p);
    expect(chip.querySelector('.chip-name')?.textContent).toBe('Rosa canina');
  });
});

// ── makeChipIcon ──────────────────────────────────────────────────────────────

describe('makeChipIcon', () => {
  it('returns an SVG element', () => {
    const svg = makeChipIcon(flowerPlant());
    expect(svg.tagName.toLowerCase()).toBe('svg');
  });

  it('flower icon has chip-petal paths colored with plant color', () => {
    const color = '#ce93d8';
    const svg = makeChipIcon(flowerPlant({ color }));
    const petal = svg.querySelector('.chip-petal');
    expect(petal?.getAttribute('fill')).toBe(color);
  });

  it('tree icon has dark green body, no chip-petal class', () => {
    const svg = makeChipIcon(treePlant());
    expect(svg.querySelector('.chip-petal')).toBeNull();
    const paths = Array.from(svg.querySelectorAll('path'));
    expect(paths.some((p) => p.getAttribute('fill') === '#2e7d32')).toBe(true);
  });
});
