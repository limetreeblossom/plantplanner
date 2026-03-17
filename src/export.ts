import type { ShapeData } from './types';

export function buildExportRows(shapes: ShapeData[]): (string | number)[][] {
  const totals: Record<string, { count: number; spacing: number }> = {};
  for (const d of shapes) {
    for (const m of d.plantMarkers) {
      const n = m.plant.name;
      if (!totals[n]) totals[n] = { count: 0, spacing: m.plant.spacing };
      totals[n].count++;
    }
  }

  const rows: (string | number)[][] = [['Plant', 'Spacing (m)', 'Count']];
  let grandTotal = 0;
  for (const [name, { count, spacing }] of Object.entries(totals)) {
    rows.push([name, spacing, count]);
    grandTotal += count;
  }
  rows.push(['Total', '', grandTotal]);

  return rows;
}
