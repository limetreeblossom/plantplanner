import type { Plant } from './types';

export interface TooltipElements {
  img: HTMLImageElement;
  sciEl: HTMLElement;
  nameEl: HTMLElement;
  metaEl: HTMLElement;
}

/**
 * Builds the meta-line HTML for the custom-plant tooltip (suitable for
 * setting as `metaEl.innerHTML`).  Pure function — no DOM side-effects.
 *
 * Always includes: spacing.
 * Optionally includes: growth_habit, height_cm.
 */
export function buildCustomTooltipHTML(plant: Plant): string {
  const spacingStr = `${plant.spacing.toFixed(2)} m`;

  const lines: string[] = [];
  lines.push(`Spacing: ${spacingStr}`);
  if (plant.growth_habit) {
    const habit = plant.growth_habit.charAt(0).toUpperCase() + plant.growth_habit.slice(1);
    lines.push(`Habit: ${habit}`);
  }
  if (plant.height_cm) lines.push(`Height: ${plant.height_cm} cm`);
  return lines.join('<br>');
}

export function applyTooltipContent(plant: Plant, els: TooltipElements): void {
  els.img.style.display = 'none';
  els.img.onload = () => {
    els.img.style.display = 'block';
  };
  els.img.onerror = () => {
    els.img.style.display = 'none';
  };
  els.img.src = plant.image_url ?? '';

  els.sciEl.textContent = plant.scientific_name ?? '';
  els.nameEl.textContent = plant.name ?? '';
  const metaLines: string[] = [];
  if (plant.family) metaLines.push(`Family: ${plant.family}`);
  if (plant.genus) metaLines.push(`Genus: ${plant.genus}`);
  if (plant.growth_habit) metaLines.push(`Habit: ${plant.growth_habit}`);
  if (plant.height_cm) metaLines.push(`Height: ${plant.height_cm} cm`);
  els.metaEl.innerHTML = metaLines.join('<br>');
}

export function clearTooltipHandlers(img: HTMLImageElement): void {
  img.onload = null;
  img.onerror = null;
}
