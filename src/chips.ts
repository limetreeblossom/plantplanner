import {
  NS,
  TREE_SHADOW_D,
  TREE_BODY_D,
  FLOWER_OUTLINE_D,
  FLOWER_PETAL_DS,
  FLOWER_CENTER_D,
} from './markers';
import type { Plant } from './types';

// ── Chip icon (inline SVG shown in the sidebar list) ─────────────────────────

export function makeChipIcon(plant: Plant): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.style.flexShrink = '0';

  if (plant.icon === 'tree') {
    svg.setAttribute('viewBox', '315 100 82 82');
    const shadow = document.createElementNS(NS, 'path') as SVGPathElement;
    shadow.setAttribute('d', TREE_SHADOW_D);
    shadow.setAttribute('fill', '#c7c7c7');
    shadow.setAttribute('fill-opacity', '0.6');
    svg.appendChild(shadow);
    const body = document.createElementNS(NS, 'path') as SVGPathElement;
    body.setAttribute('d', TREE_BODY_D);
    body.setAttribute('fill', '#2e7d32');
    body.setAttribute('stroke', '#1b5e20');
    body.setAttribute('stroke-width', '1');
    svg.appendChild(body);
  } else {
    svg.setAttribute('viewBox', '30 30 540 540');
    const outline = document.createElementNS(NS, 'path') as SVGPathElement;
    outline.setAttribute('d', FLOWER_OUTLINE_D);
    outline.setAttribute('fill', '#1a1a1a');
    svg.appendChild(outline);
    for (const d of FLOWER_PETAL_DS) {
      const p = document.createElementNS(NS, 'path') as SVGPathElement;
      p.setAttribute('d', d);
      p.setAttribute('fill', plant.color);
      p.classList.add('chip-petal');
      svg.appendChild(p);
    }
    const center = document.createElementNS(NS, 'path') as SVGPathElement;
    center.setAttribute('d', FLOWER_CENTER_D);
    center.setAttribute('fill', '#fff');
    svg.appendChild(center);
  }
  return svg;
}

// ── Chip element builder (structure only — caller attaches event listeners) ──

export function buildChipEl(plant: Plant, effective: Plant): HTMLDivElement {
  const chip = document.createElement('div');
  chip.className = 'plant-chip';
  chip.draggable = true;
  chip.dataset.plantJson = JSON.stringify(effective);

  chip.appendChild(makeChipIcon(effective));

  const nameSpan = document.createElement('span');
  nameSpan.className = 'chip-name';
  // Custom plants have no scientific name — always show the user-given name
  nameSpan.textContent = plant.isCustom ? plant.name : (plant.scientific_name ?? plant.name);
  chip.appendChild(nameSpan);

  return chip;
}
