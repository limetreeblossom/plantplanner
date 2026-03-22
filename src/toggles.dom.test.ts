// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  applyRingsToggle,
  applyGridToggle,
  applyBgToggle,
  applyFlowersToggle,
  applyTreesToggle,
  applyLegendToggle,
} from './toggles';

// ── I. Visibility toggles ─────────────────────────────────────────────────────

describe('applyRingsToggle', () => {
  it('adds hide-rings when unchecked', () => {
    const el = document.createElement('div');
    applyRingsToggle(el, false);
    expect(el.classList.contains('hide-rings')).toBe(true);
  });

  it('removes hide-rings when checked', () => {
    const el = document.createElement('div');
    el.classList.add('hide-rings');
    applyRingsToggle(el, true);
    expect(el.classList.contains('hide-rings')).toBe(false);
  });
});

describe('applyGridToggle', () => {
  it('adds hide-grid when unchecked', () => {
    const el = document.createElement('div');
    applyGridToggle(el, false);
    expect(el.classList.contains('hide-grid')).toBe(true);
  });

  it('removes hide-grid when checked', () => {
    const el = document.createElement('div');
    el.classList.add('hide-grid');
    applyGridToggle(el, true);
    expect(el.classList.contains('hide-grid')).toBe(false);
  });
});

describe('applyBgToggle', () => {
  it('adds hide-bg when unchecked', () => {
    const el = document.createElement('div');
    applyBgToggle(el, false);
    expect(el.classList.contains('hide-bg')).toBe(true);
  });

  it('removes hide-bg when checked', () => {
    const el = document.createElement('div');
    el.classList.add('hide-bg');
    applyBgToggle(el, true);
    expect(el.classList.contains('hide-bg')).toBe(false);
  });
});

describe('applyFlowersToggle', () => {
  it('adds hide-flowers when unchecked', () => {
    const el = document.createElement('div');
    applyFlowersToggle(el, false);
    expect(el.classList.contains('hide-flowers')).toBe(true);
  });

  it('removes hide-flowers when checked', () => {
    const el = document.createElement('div');
    el.classList.add('hide-flowers');
    applyFlowersToggle(el, true);
    expect(el.classList.contains('hide-flowers')).toBe(false);
  });
});

describe('applyTreesToggle', () => {
  it('adds hide-trees when unchecked', () => {
    const el = document.createElement('div');
    applyTreesToggle(el, false);
    expect(el.classList.contains('hide-trees')).toBe(true);
  });

  it('removes hide-trees when checked', () => {
    const el = document.createElement('div');
    el.classList.add('hide-trees');
    applyTreesToggle(el, true);
    expect(el.classList.contains('hide-trees')).toBe(false);
  });
});

describe('applyLegendToggle', () => {
  it('hides legendGroup when unchecked', () => {
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g') as SVGGElement;
    applyLegendToggle(g, false);
    expect(g.style.display).toBe('none');
  });

  it('shows legendGroup when checked', () => {
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g') as SVGGElement;
    g.style.display = 'none';
    applyLegendToggle(g, true);
    expect(g.style.display).toBe('');
  });
});
