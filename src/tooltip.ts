import type { Plant } from './types';

export interface TooltipElements {
  img: HTMLImageElement;
  sciEl: HTMLElement;
  nameEl: HTMLElement;
  metaEl: HTMLElement;
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
  els.metaEl.innerHTML = metaLines.join('<br>');
}

export function clearTooltipHandlers(img: HTMLImageElement): void {
  img.onload = null;
  img.onerror = null;
}
