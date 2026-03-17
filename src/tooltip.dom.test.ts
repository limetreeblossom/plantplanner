// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { applyTooltipContent, clearTooltipHandlers } from './tooltip';
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
