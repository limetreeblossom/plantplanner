import { describe, it, expect } from 'vitest';
import { buildSaveData, parseSaveData, SAVE_VERSION } from './saveload';
import type { ShapeData, Plant } from './types';

function plant(overrides: Partial<Plant> = {}): Plant {
  return { name: 'Rose', spacing: 0.5, color: '#f48fb1', ...overrides };
}

function rectShape(x = 0, y = 0, w = 200, h = 100): ShapeData {
  return {
    type: 'rect',
    el: null as unknown as SVGGeometryElement,
    labelEl: null,
    fill: '#eee',
    stroke: '#999',
    x,
    y,
    w,
    h,
    plantMarkers: [],
  };
}

// ── buildSaveData ─────────────────────────────────────────────────────────────

describe('buildSaveData', () => {
  it('sets version to SAVE_VERSION', () => {
    const data = buildSaveData([], {}, 100, null);
    expect(data.version).toBe(SAVE_VERSION);
  });

  it('preserves sessionScale', () => {
    const data = buildSaveData([], {}, 123, null);
    expect(data.sessionScale).toBe(123);
  });

  it('serialises a rect shape with geometry', () => {
    const shape = rectShape(10, 20, 300, 150);
    const data = buildSaveData([shape], {}, 100, null);
    expect(data.shapes).toHaveLength(1);
    const s = data.shapes[0];
    expect(s.type).toBe('rect');
    if (s.type === 'rect') {
      expect(s.x).toBe(10);
      expect(s.y).toBe(20);
      expect(s.w).toBe(300);
      expect(s.h).toBe(150);
    }
  });

  it('serialises plant markers within a shape', () => {
    const shape = rectShape();
    const p = plant({ name: 'Tulip' });
    shape.plantMarkers = [{ plant: p, x: 50, y: 60, el: null as unknown as SVGGElement }];
    const data = buildSaveData([shape], {}, 100, null);
    expect(data.shapes[0].markers).toHaveLength(1);
    expect(data.shapes[0].markers[0].plant.name).toBe('Tulip');
    expect(data.shapes[0].markers[0].x).toBe(50);
    expect(data.shapes[0].markers[0].y).toBe(60);
  });

  it('includes overrides', () => {
    const data = buildSaveData(
      [],
      { 'rosa-canina': { spacing: 1.2, color: '#ff0000' } },
      100,
      null,
    );
    expect(data.overrides['rosa-canina']).toEqual({ spacing: 1.2, color: '#ff0000' });
  });

  it('includes bgImage when provided', () => {
    const bg = { dataUrl: 'data:image/png;base64,abc', x: 10, y: 20 };
    const data = buildSaveData([], {}, 100, bg);
    expect(data.bgImage).toEqual(bg);
  });

  it('sets bgImage to null when not provided', () => {
    const data = buildSaveData([], {}, 100, null);
    expect(data.bgImage).toBeNull();
  });
});

// ── parseSaveData ─────────────────────────────────────────────────────────────

describe('parseSaveData', () => {
  function validJson(overrides: object = {}): string {
    return JSON.stringify({
      version: SAVE_VERSION,
      sessionScale: 100,
      bgImage: null,
      shapes: [],
      overrides: {},
      ...overrides,
    });
  }

  it('returns parsed data for a valid file', () => {
    const data = parseSaveData(validJson());
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.shapes).toEqual([]);
  });

  it('throws on non-JSON input', () => {
    expect(() => parseSaveData('not json')).toThrow('not valid JSON');
  });

  it('throws on wrong version', () => {
    expect(() => parseSaveData(validJson({ version: 99 }))).toThrow('Unsupported file version');
  });

  it('throws when shapes is missing', () => {
    const json = JSON.stringify({ version: SAVE_VERSION, sessionScale: 100 });
    expect(() => parseSaveData(json)).toThrow('missing shapes');
  });

  it('throws when sessionScale is missing', () => {
    const json = JSON.stringify({ version: SAVE_VERSION, shapes: [] });
    expect(() => parseSaveData(json)).toThrow('missing sessionScale');
  });
});
