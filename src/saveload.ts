import type { ShapeData } from './types';
import type { PlantOverride } from './plantStore';
import type { Plant } from './types';

export const SAVE_VERSION = 1 as const;

// ── Serialisable types ────────────────────────────────────────────────────────

export interface SavedMarker {
  plant: Plant;
  x: number;
  y: number;
}

type SavedBase = { fill: string; stroke: string; markers: SavedMarker[] };

export type SavedShape =
  | (SavedBase & { type: 'rect'; x: number; y: number; w: number; h: number })
  | (SavedBase & { type: 'circle'; cx: number; cy: number; r: number })
  | (SavedBase & { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number })
  | (SavedBase & { type: 'polygon'; points: Array<{ x: number; y: number }> });

export interface SavedBgImage {
  dataUrl: string;
  x: number;
  y: number;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  sessionScale: number;
  bgImage: SavedBgImage | null;
  shapes: SavedShape[];
  overrides: Record<string, PlantOverride>;
}

// ── Build ─────────────────────────────────────────────────────────────────────

export function buildSaveData(
  shapes: ShapeData[],
  overrides: Record<string, PlantOverride>,
  sessionScale: number,
  bgImage: SavedBgImage | null,
): SaveData {
  const savedShapes: SavedShape[] = shapes.map((d) => {
    const markers: SavedMarker[] = d.plantMarkers.map((m) => ({
      plant: m.plant,
      x: m.x,
      y: m.y,
    }));
    const base: SavedBase = { fill: d.fill, stroke: d.stroke, markers };
    if (d.type === 'rect') return { ...base, type: 'rect', x: d.x, y: d.y, w: d.w, h: d.h };
    if (d.type === 'circle') return { ...base, type: 'circle', cx: d.cx, cy: d.cy, r: d.r };
    if (d.type === 'ellipse')
      return { ...base, type: 'ellipse', cx: d.cx, cy: d.cy, rx: d.rx, ry: d.ry };
    return { ...base, type: 'polygon', points: d.points.map((p) => ({ x: p.x, y: p.y })) };
  });

  return {
    version: SAVE_VERSION,
    sessionScale,
    bgImage,
    shapes: savedShapes,
    overrides,
  };
}

// ── Parse & validate ──────────────────────────────────────────────────────────

export function parseSaveData(json: string): SaveData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('Invalid file: not valid JSON.');
  }
  if (typeof raw !== 'object' || raw === null)
    throw new Error('Invalid file: expected a JSON object.');
  const d = raw as Record<string, unknown>;
  if (d['version'] !== SAVE_VERSION)
    throw new Error(`Unsupported file version: ${String(d['version'])}. Expected ${SAVE_VERSION}.`);
  if (!Array.isArray(d['shapes'])) throw new Error('Invalid file: missing shapes array.');
  if (typeof d['sessionScale'] !== 'number') throw new Error('Invalid file: missing sessionScale.');
  return raw as SaveData;
}
