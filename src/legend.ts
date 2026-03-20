import { makeChipIcon } from './chips';
import { NS } from './markers';
import type { Plant, ShapeData } from './types';
import { summaryDisplayName } from './summary';

// ── Layout constants ─────────────────────────────────────────────────────────
const ROW_HEIGHT = 24; // px per legend row
const ICON_SIZE = 18; // icon width/height
const PAD_X = 8; // horizontal inner padding
const PAD_Y = 8; // vertical inner padding (top and bottom)
const BOX_W = 230; // legend box width
const FONT_SIZE = 11; // label font size

// ── Legend entry collector ────────────────────────────────────────────────────

/** Returns unique plants currently placed on the canvas, in insertion order. */
export function collectLegendEntries(shapes: ShapeData[]): Plant[] {
  const seen = new Map<string, Plant>();
  for (const shape of shapes) {
    for (const m of shape.plantMarkers) {
      const key = m.plant.slug ?? m.plant.scientific_name ?? m.plant.name;
      if (!seen.has(key)) seen.set(key, m.plant);
    }
  }
  return Array.from(seen.values());
}

// ── Legend renderer ───────────────────────────────────────────────────────────

/**
 * Rebuilds the contents of legendGroup to show one row per unique placed plant.
 * Hides the group entirely when there are no entries or the toggle is off.
 * Does NOT modify the group's `transform` attribute — positioning is handled
 * externally to allow user dragging.
 */
export function renderLegend(
  legendGroup: SVGGElement,
  shapes: ShapeData[],
  legendVisible: boolean,
): void {
  legendGroup.innerHTML = '';

  const entries = collectLegendEntries(shapes);

  if (entries.length === 0 || !legendVisible) {
    legendGroup.style.display = 'none';
    return;
  }

  legendGroup.style.display = '';
  legendGroup.style.cursor = 'move';

  const totalH = PAD_Y + entries.length * ROW_HEIGHT + PAD_Y;

  // Background rect
  const bg = document.createElementNS(NS, 'rect') as SVGRectElement;
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width', String(BOX_W));
  bg.setAttribute('height', String(totalH));
  bg.setAttribute('rx', '4');
  bg.setAttribute('fill', 'rgba(255,255,255,0.92)');
  bg.setAttribute('stroke', '#ccc');
  bg.setAttribute('stroke-width', '1');
  legendGroup.appendChild(bg);

  entries.forEach((plant, i) => {
    const rowY = PAD_Y + i * ROW_HEIGHT;

    // Flower/tree icon — reuse chip icon, sized to ICON_SIZE
    const icon = makeChipIcon(plant);
    icon.setAttribute('x', String(PAD_X));
    icon.setAttribute('y', String(rowY + (ROW_HEIGHT - ICON_SIZE) / 2));
    icon.setAttribute('width', String(ICON_SIZE));
    icon.setAttribute('height', String(ICON_SIZE));
    icon.removeAttribute('style'); // strip flex-shrink: 0
    legendGroup.appendChild(icon);

    // Plant name label
    const label = document.createElementNS(NS, 'text') as SVGTextElement;
    label.setAttribute('x', String(PAD_X + ICON_SIZE + 6));
    label.setAttribute('y', String(rowY + ROW_HEIGHT / 2 + FONT_SIZE / 2 - 1));
    label.setAttribute('font-size', String(FONT_SIZE));
    label.setAttribute('fill', '#333');
    label.setAttribute('font-family', 'system-ui, sans-serif');
    const spacingCm = Math.round(plant.spacing * 100);
    label.textContent = `${summaryDisplayName(plant)} (c/c: ${spacingCm} cm)`;
    legendGroup.appendChild(label);
  });
}
