import type { Plant, ShapeData } from './types';

export function summaryDisplayName(plant: Plant): string {
  // Custom plants have no scientific name — always show the user-given name
  if (plant.isCustom) return plant.name;
  return plant.scientific_name ?? plant.name;
}

export function aggregatePlantCounts(
  shapes: ShapeData[],
): Map<string, { count: number; plant: Plant }> {
  const totals = new Map<string, { count: number; plant: Plant }>();
  for (const d of shapes) {
    for (const m of d.plantMarkers) {
      const key = m.plant.slug ?? m.plant.scientific_name ?? m.plant.name;
      const entry = totals.get(key);
      if (entry) entry.count++;
      else totals.set(key, { count: 1, plant: m.plant });
    }
  }
  return totals;
}
