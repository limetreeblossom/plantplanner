import { describe, it, expect } from 'vitest';
import { PLANTS } from './plants';

describe('PLANTS database', () => {
  it('has at least 10 entries', () => {
    expect(PLANTS.length).toBeGreaterThanOrEqual(10);
  });

  it('every plant has a non-empty name', () => {
    for (const p of PLANTS) {
      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);
    }
  });

  it('every plant has a realistic spacing (0.1–2.0 m)', () => {
    for (const p of PLANTS) {
      expect(p.spacing).toBeGreaterThanOrEqual(0.1);
      expect(p.spacing).toBeLessThanOrEqual(2.0);
    }
  });

  it('every plant color is a CSS hex string starting with #', () => {
    for (const p of PLANTS) {
      expect(p.color).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });

  it('all plant names are unique', () => {
    const names = PLANTS.map(p => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
