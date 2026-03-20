import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getOverride, setOverride, deleteOverride, subscribe, _resetStore } from './plantStore';

beforeEach(() => _resetStore());

// ── getOverride ────────────────────────────────────────────────────────────

describe('getOverride', () => {
  it('returns null for a slug with no override', () => {
    expect(getOverride('rosa-canina')).toBeNull();
  });
});

// ── setOverride ────────────────────────────────────────────────────────────

describe('setOverride', () => {
  it('stores a spacing override', () => {
    const result = setOverride('rosa-canina', { spacing: 0.45 });
    expect(result.ok).toBe(true);
    expect(getOverride('rosa-canina')).toMatchObject({ spacing: 0.45 });
  });

  it('stores a color override', () => {
    setOverride('rosa-canina', { color: '#e91e63' });
    expect(getOverride('rosa-canina')).toMatchObject({ color: '#e91e63' });
  });

  it('merges fields into an existing override', () => {
    setOverride('rosa-canina', { spacing: 0.45 });
    setOverride('rosa-canina', { color: '#e91e63' });
    expect(getOverride('rosa-canina')).toMatchObject({ spacing: 0.45, color: '#e91e63' });
  });

  it('overwrites a previously set field', () => {
    setOverride('rosa-canina', { spacing: 0.45 });
    setOverride('rosa-canina', { spacing: 0.6 });
    expect(getOverride('rosa-canina')!.spacing).toBe(0.6);
  });

  it('accepts spacing at the lower bound (0.10 m)', () => {
    expect(setOverride('rosa-canina', { spacing: 0.1 }).ok).toBe(true);
  });

  it('accepts spacing at the upper bound (3.0 m)', () => {
    expect(setOverride('rosa-canina', { spacing: 3.0 }).ok).toBe(true);
  });

  it('rejects spacing below 0.10 m', () => {
    const result = setOverride('rosa-canina', { spacing: 0.05 });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/spacing/i);
    expect(getOverride('rosa-canina')).toBeNull();
  });

  it('rejects spacing above 3.0 m', () => {
    const result = setOverride('rosa-canina', { spacing: 5.0 });
    expect(result.ok).toBe(false);
    expect(getOverride('rosa-canina')).toBeNull();
  });

  it('accepts a 3-digit hex color', () => {
    expect(setOverride('rosa-canina', { color: '#abc' }).ok).toBe(true);
  });

  it('accepts a 6-digit hex color', () => {
    expect(setOverride('rosa-canina', { color: '#aabbcc' }).ok).toBe(true);
  });

  it('accepts an 8-digit hex color (with alpha)', () => {
    expect(setOverride('rosa-canina', { color: '#aabbccdd' }).ok).toBe(true);
  });

  it('rejects a non-hex color string', () => {
    const result = setOverride('rosa-canina', { color: 'red' });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/color/i);
    expect(getOverride('rosa-canina')).toBeNull();
  });

  it('rejects an empty slug', () => {
    const result = setOverride('', { spacing: 0.3 });
    expect(result.ok).toBe(false);
  });

  it('does not partially apply if one field is invalid', () => {
    // spacing valid, color invalid — neither should be stored
    const result = setOverride('rosa-canina', { spacing: 0.45, color: 'blue' });
    expect(result.ok).toBe(false);
    expect(getOverride('rosa-canina')).toBeNull();
  });

  it('stores a height_cm override', () => {
    const result = setOverride('rosa-canina', { height_cm: 80 });
    expect(result.ok).toBe(true);
    expect(getOverride('rosa-canina')).toMatchObject({ height_cm: 80 });
  });

  it('rejects height_cm of zero', () => {
    const result = setOverride('rosa-canina', { height_cm: 0 });
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toMatch(/height/i);
    expect(getOverride('rosa-canina')).toBeNull();
  });

  it('rejects negative height_cm', () => {
    const result = setOverride('rosa-canina', { height_cm: -10 });
    expect(result.ok).toBe(false);
    expect(getOverride('rosa-canina')).toBeNull();
  });

  it('accepts fractional height_cm', () => {
    expect(setOverride('rosa-canina', { height_cm: 0.5 }).ok).toBe(true);
  });

  it('merges height_cm with existing spacing/color override', () => {
    setOverride('rosa-canina', { spacing: 0.45, color: '#e91e63' });
    setOverride('rosa-canina', { height_cm: 120 });
    expect(getOverride('rosa-canina')).toMatchObject({
      spacing: 0.45,
      color: '#e91e63',
      height_cm: 120,
    });
  });

  it('clears height_cm when null is passed', () => {
    setOverride('rosa-canina', { spacing: 0.45, color: '#e91e63', height_cm: 80 });
    setOverride('rosa-canina', { height_cm: null });
    const override = getOverride('rosa-canina')!;
    expect('height_cm' in override).toBe(false);
    expect(override.spacing).toBe(0.45); // other fields preserved
  });
});

// ── deleteOverride ─────────────────────────────────────────────────────────

describe('deleteOverride', () => {
  it('removes an existing override', () => {
    setOverride('rosa-canina', { spacing: 0.45 });
    const ok = deleteOverride('rosa-canina');
    expect(ok).toBe(true);
    expect(getOverride('rosa-canina')).toBeNull();
  });

  it('returns false for a slug with no override', () => {
    expect(deleteOverride('unknown-slug')).toBe(false);
  });
});

// ── subscribe ──────────────────────────────────────────────────────────────

describe('subscribe', () => {
  it('notifies on setOverride (success)', () => {
    const fn = vi.fn();
    subscribe(fn);
    setOverride('rosa-canina', { spacing: 0.45 });
    expect(fn).toHaveBeenCalledOnce();
  });

  it('notifies on deleteOverride (success)', () => {
    setOverride('rosa-canina', { spacing: 0.45 });
    const fn = vi.fn();
    subscribe(fn);
    deleteOverride('rosa-canina');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('does not notify when setOverride fails validation', () => {
    const fn = vi.fn();
    subscribe(fn);
    setOverride('rosa-canina', { spacing: 99 });
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not notify when deleteOverride finds nothing', () => {
    const fn = vi.fn();
    subscribe(fn);
    deleteOverride('unknown-slug');
    expect(fn).not.toHaveBeenCalled();
  });
});
