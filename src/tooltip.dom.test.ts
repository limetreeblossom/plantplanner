// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { applyTooltipContent, buildCustomTooltipHTML, clearTooltipHandlers } from './tooltip';
import type { Plant } from './types';

function plant(overrides: Partial<Plant> = {}): Plant {
  return { name: 'Rose', spacing: 0.5, color: '#f48fb1', ...overrides };
}

function makeEls() {
  return {
    img: document.createElement('img'),
    sciEl: document.createElement('div'),
    nameEl: document.createElement('div'),
    metaEl: document.createElement('div'),
  };
}

// ── E. Tooltip content ────────────────────────────────────────────────────────

describe('applyTooltipContent', () => {
  it('sets sciEl text to scientific_name', () => {
    const els = makeEls();
    applyTooltipContent(plant({ scientific_name: 'Rosa canina' }), els);
    expect(els.sciEl.textContent).toBe('Rosa canina');
  });

  it('sets nameEl text to plant name', () => {
    const els = makeEls();
    applyTooltipContent(plant({ name: 'Dog Rose' }), els);
    expect(els.nameEl.textContent).toBe('Dog Rose');
  });

  it('hides image immediately before load', () => {
    const els = makeEls();
    els.img.style.display = 'block';
    applyTooltipContent(plant({ image_url: 'https://example.com/img.jpg' }), els);
    expect(els.img.style.display).toBe('none');
  });

  it('sets img src to plant image_url', () => {
    const els = makeEls();
    applyTooltipContent(plant({ image_url: 'https://example.com/img.jpg' }), els);
    expect(els.img.src).toContain('example.com/img.jpg');
  });
});

describe('clearTooltipHandlers', () => {
  it('sets onload and onerror to null', () => {
    const img = document.createElement('img');
    img.onload = () => {};
    img.onerror = () => {};
    clearTooltipHandlers(img);
    expect(img.onload).toBeNull();
    expect(img.onerror).toBeNull();
  });
});

// ── buildCustomTooltipHTML ────────────────────────────────────────────────────

describe('buildCustomTooltipHTML', () => {
  function customPlant(overrides: Partial<Plant> = {}): Plant {
    return {
      name: 'My Lavender',
      spacing: 0.45,
      color: '#9c27b0',
      isCustom: true,
      ...overrides,
    };
  }

  it('includes spacing formatted to 2 decimal places', () => {
    const html = buildCustomTooltipHTML(customPlant({ spacing: 0.3 }));
    expect(html).toContain('0.30 m');
  });

  it('does not include the plant colour hex', () => {
    const html = buildCustomTooltipHTML(customPlant({ color: '#ff5722' }));
    expect(html).not.toContain('#ff5722');
  });

  it('does not include a colour swatch span', () => {
    const html = buildCustomTooltipHTML(customPlant({ color: '#ff5722' }));
    expect(html).not.toContain('background:#ff5722');
  });

  it('includes growth_habit capitalised when set', () => {
    const html = buildCustomTooltipHTML(customPlant({ growth_habit: 'shrub' }));
    expect(html).toContain('Shrub');
    expect(html).not.toContain('shrub');
  });

  it('omits growth_habit line when not set', () => {
    const html = buildCustomTooltipHTML(customPlant({ growth_habit: undefined }));
    expect(html).not.toContain('Habit:');
  });

  it('includes height_cm when set', () => {
    const html = buildCustomTooltipHTML(customPlant({ height_cm: 120 }));
    expect(html).toContain('120 cm');
  });

  it('omits height line when height_cm is not set', () => {
    const html = buildCustomTooltipHTML(customPlant({ height_cm: undefined }));
    expect(html).not.toContain('Height:');
  });

  it('always includes Spacing line', () => {
    const html = buildCustomTooltipHTML(customPlant());
    expect(html).toContain('Spacing:');
    expect(html).not.toContain('Colour:');
  });
});
