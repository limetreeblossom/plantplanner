// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { applyRingsToggle, applyGridToggle, applyBgToggle } from './toggles';

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
