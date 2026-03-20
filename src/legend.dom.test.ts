// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { collectLegendEntries, renderLegend } from './legend';
import type { ShapeData, Plant } from './types';

// ── Helpers ─────────────────────────────────────────────────────────────────

const NS = 'http://www.w3.org/2000/svg';

function makeSVGGroup(): SVGGElement {
  return document.createElementNS(NS, 'g') as SVGGElement;
}

function makePlant(overrides: Partial<Plant> = {}): Plant {
  return {
    name: 'Test Plant',
    spacing: 0.3,
    color: '#ff0000',
    ...overrides,
  };
}

function makeShape(plants: Plant[]): ShapeData {
  return {
    type: 'rect',
    el: document.createElementNS(NS, 'rect') as unknown as SVGGeometryElement,
    fill: '#ccc',
    stroke: '#999',
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    plantMarkers: plants.map((plant) => ({
      plant,
      x: 50,
      y: 50,
      el: document.createElementNS(NS, 'g') as SVGGElement,
    })),
  };
}

// ── collectLegendEntries ─────────────────────────────────────────────────────

describe('collectLegendEntries', () => {
  it('returns empty array when no shapes', () => {
    expect(collectLegendEntries([])).toEqual([]);
  });

  it('returns empty array when shapes have no markers', () => {
    const shape = makeShape([]);
    expect(collectLegendEntries([shape])).toEqual([]);
  });

  it('returns one entry per unique plant slug', () => {
    const rose: Plant = makePlant({ slug: 'rosa-canina', scientific_name: 'Rosa canina' });
    const tulip: Plant = makePlant({
      slug: 'tulipa-gesneriana',
      scientific_name: 'Tulipa gesneriana',
      color: '#ffff00',
    });
    const shape = makeShape([rose, tulip, rose]); // rose appears twice
    const entries = collectLegendEntries([shape]);
    expect(entries).toHaveLength(2);
    expect(entries[0].slug).toBe('rosa-canina');
    expect(entries[1].slug).toBe('tulipa-gesneriana');
  });

  it('deduplicates by scientific_name when slug is absent', () => {
    const p1: Plant = makePlant({ scientific_name: 'Achillea millefolium' });
    const p2: Plant = makePlant({ scientific_name: 'Achillea millefolium' }); // same species, different object
    const shape = makeShape([p1, p2]);
    const entries = collectLegendEntries([shape]);
    expect(entries).toHaveLength(1);
  });

  it('deduplicates by name when both slug and scientific_name absent (custom plants)', () => {
    const p1: Plant = makePlant({ name: 'My Lavender', isCustom: true });
    const p2: Plant = makePlant({ name: 'My Lavender', isCustom: true });
    const shape = makeShape([p1, p2]);
    const entries = collectLegendEntries([shape]);
    expect(entries).toHaveLength(1);
  });

  it('collects plants across multiple shapes', () => {
    const rose: Plant = makePlant({ slug: 'rosa' });
    const tulip: Plant = makePlant({ slug: 'tulipa', color: '#ffff00' });
    const s1 = makeShape([rose]);
    const s2 = makeShape([tulip]);
    const entries = collectLegendEntries([s1, s2]);
    expect(entries).toHaveLength(2);
  });
});

// ── renderLegend ─────────────────────────────────────────────────────────────

describe('renderLegend', () => {
  let g: SVGGElement;

  beforeEach(() => {
    g = makeSVGGroup();
  });

  it('hides group and renders nothing when no plants placed', () => {
    renderLegend(g, [], true);
    expect(g.style.display).toBe('none');
    expect(g.children).toHaveLength(0);
  });

  it('hides group when toggle is off even if plants are placed', () => {
    const shape = makeShape([makePlant({ slug: 'rosa' })]);
    renderLegend(g, [shape], false);
    expect(g.style.display).toBe('none');
  });

  it('shows group when toggle is on and plants are placed', () => {
    const shape = makeShape([makePlant({ slug: 'rosa' })]);
    renderLegend(g, [shape], true);
    expect(g.style.display).toBe('');
  });

  it('renders a background rect and one icon+label row per unique plant (no title)', () => {
    const rose: Plant = makePlant({ slug: 'rosa', scientific_name: 'Rosa canina' });
    const tulip: Plant = makePlant({
      slug: 'tulipa',
      scientific_name: 'Tulipa gesneriana',
      color: '#ffff00',
    });
    const shape = makeShape([rose, tulip]);
    renderLegend(g, [shape], true);

    // Background rect + 2×(svg icon + text) = 1 + 4 = 5
    expect(g.children).toHaveLength(5);

    const rect = g.querySelector('rect');
    expect(rect).not.toBeNull();

    // No title — only the two plant name labels
    const texts = g.querySelectorAll('text');
    expect(texts).toHaveLength(2);

    // Icons are nested <svg> elements, not circles at the top level
    const icons = g.querySelectorAll('svg');
    expect(icons).toHaveLength(2);
  });

  it('shows scientific_name for Trefle plants in the label', () => {
    const plant: Plant = makePlant({ slug: 'rosa', scientific_name: 'Rosa canina' });
    renderLegend(g, [makeShape([plant])], true);
    const texts = Array.from(g.querySelectorAll('text'));
    const labelTexts = texts.map((t) => t.textContent ?? '');
    expect(labelTexts.some((t) => t === 'Rosa canina (c/c: 30 cm)')).toBe(true);
  });

  it('shows plant.name for custom plants in the label', () => {
    const plant: Plant = makePlant({ name: 'My Lavender', isCustom: true });
    renderLegend(g, [makeShape([plant])], true);
    const texts = Array.from(g.querySelectorAll('text'));
    const labelTexts = texts.map((t) => t.textContent ?? '');
    expect(labelTexts.some((t) => t === 'My Lavender (c/c: 30 cm)')).toBe(true);
  });

  it('uses plant color for icon petal fill', () => {
    const plant: Plant = makePlant({ slug: 'test', color: '#aabbcc' });
    renderLegend(g, [makeShape([plant])], true);
    // The flower icon's petal paths carry the plant color
    const coloredPath = g.querySelector('path[fill="#aabbcc"]');
    expect(coloredPath).not.toBeNull();
  });

  it('clears previous contents on re-render', () => {
    const shape = makeShape([makePlant({ slug: 'rosa', scientific_name: 'Rosa canina' })]);
    renderLegend(g, [shape], true);
    const countBefore = g.children.length;
    // Re-render with same data
    renderLegend(g, [shape], true);
    expect(g.children.length).toBe(countBefore);
  });
});
