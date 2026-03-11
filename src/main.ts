import { PLANTS } from './plants';
import {
  SCALE, CANVAS_W, CANVAS_H,
  pxToM, fmt, calcArea, shapeCentroid, pointInShape,
} from './geometry';
import type { ShapeData, LabelEl, PlantMarker, Plant } from './types';

// ── Constants ──────────────────────────────────────────────────────────────
const NS = 'http://www.w3.org/2000/svg';

const FILL_COLORS: string[] = [
  'rgba(76,175,80,0.22)', 'rgba(255,193,7,0.22)',
  'rgba(33,150,243,0.22)', 'rgba(233,30,99,0.22)',
  'rgba(156,39,176,0.22)', 'rgba(255,87,34,0.22)',
];
const STROKE_COLORS: string[] = [
  '#388e3c', '#f9a825', '#1565c0', '#880e4f', '#6a1b9a', '#bf360c',
];
let colorIndex = 0;

// ── DOM refs ───────────────────────────────────────────────────────────────
const svgEl          = document.getElementById('canvas') as SVGSVGElement;
const shapesLayer    = document.getElementById('shapes-layer') as SVGGElement;
const markersLayer   = document.getElementById('markers-layer') as SVGGElement;
const labelLayer     = document.getElementById('label-layer') as SVGGElement;
const overlayLayer   = document.getElementById('overlay-layer') as SVGGElement;
const infoContent    = document.getElementById('info-content') as HTMLDivElement;
const summaryContent = document.getElementById('summary-content') as HTMLDivElement;
const deleteBtn      = document.getElementById('delete-btn') as HTMLButtonElement;
const statusMsg      = document.getElementById('status-msg') as HTMLSpanElement;
const plantListEl    = document.getElementById('plant-list') as HTMLDivElement;

// ── State ──────────────────────────────────────────────────────────────────
type Tool = 'select' | 'rect' | 'circle' | 'ellipse';
let currentTool: Tool = 'select';
let drawing   = false;
let startX    = 0;
let startY    = 0;
let activeEl: SVGElement | null = null;
let selectedData: ShapeData | null = null;
let shapes: ShapeData[] = [];

// ── Grid ───────────────────────────────────────────────────────────────────
function drawGrid(): void {
  const g = document.getElementById('grid-layer') as SVGGElement;

  for (let x = 0; x <= CANVAS_W; x += 50) {
    const major = x % SCALE === 0;
    const ln = document.createElementNS(NS, 'line');
    ln.setAttribute('x1', String(x)); ln.setAttribute('y1', '0');
    ln.setAttribute('x2', String(x)); ln.setAttribute('y2', String(CANVAS_H));
    ln.setAttribute('stroke', major ? '#c8d8c0' : '#e8f0e4');
    ln.setAttribute('stroke-width', major ? '1' : '0.5');
    g.appendChild(ln);
  }
  for (let y = 0; y <= CANVAS_H; y += 50) {
    const major = y % SCALE === 0;
    const ln = document.createElementNS(NS, 'line');
    ln.setAttribute('x1', '0'); ln.setAttribute('y1', String(y));
    ln.setAttribute('x2', String(CANVAS_W)); ln.setAttribute('y2', String(y));
    ln.setAttribute('stroke', major ? '#c8d8c0' : '#e8f0e4');
    ln.setAttribute('stroke-width', major ? '1' : '0.5');
    g.appendChild(ln);
  }
  for (let m = 1; m * SCALE <= CANVAS_W; m++) {
    const txt = document.createElementNS(NS, 'text');
    txt.setAttribute('x', String(m * SCALE)); txt.setAttribute('y', '11');
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('font-size', '9'); txt.setAttribute('fill', '#aac0a0');
    txt.textContent = m + 'm'; g.appendChild(txt);
  }
  for (let m = 1; m * SCALE <= CANVAS_H; m++) {
    const txt = document.createElementNS(NS, 'text');
    txt.setAttribute('x', '4'); txt.setAttribute('y', String(m * SCALE + 4));
    txt.setAttribute('font-size', '9'); txt.setAttribute('fill', '#aac0a0');
    txt.textContent = m + 'm'; g.appendChild(txt);
  }
}

// ── Floating dimension label (during draw) ─────────────────────────────────
interface DimLabel {
  g: SVGGElement;
  bg: SVGRectElement;
  tx: SVGTextElement;
}
let dimLabel: DimLabel | null = null;

function ensureDimLabel(): void {
  if (dimLabel) return;
  const g  = document.createElementNS(NS, 'g') as SVGGElement;
  const bg = document.createElementNS(NS, 'rect') as SVGRectElement;
  bg.setAttribute('fill', 'rgba(0,0,0,0.65)'); bg.setAttribute('rx', '3');
  const tx = document.createElementNS(NS, 'text') as SVGTextElement;
  tx.setAttribute('fill', '#fff'); tx.setAttribute('font-size', '11');
  tx.setAttribute('font-family', 'system-ui,sans-serif');
  tx.setAttribute('text-anchor', 'middle');
  tx.setAttribute('dominant-baseline', 'middle');
  g.appendChild(bg); g.appendChild(tx);
  overlayLayer.appendChild(g);
  dimLabel = { g, bg, tx };
}

function updateDimLabel(x: number, y: number, text: string): void {
  ensureDimLabel();
  const d = dimLabel!;
  const pad = 5, h = 18;
  const w = text.length * 6.2 + pad * 2;
  d.tx.textContent = text;
  d.bg.setAttribute('width', String(w));  d.bg.setAttribute('height', String(h));
  d.bg.setAttribute('x', String(x - w / 2)); d.bg.setAttribute('y', String(y - h / 2));
  d.tx.setAttribute('x', String(x)); d.tx.setAttribute('y', String(y));
  d.g.style.display = '';
}

function hideDimLabel(): void { if (dimLabel) dimLabel.g.style.display = 'none'; }

// ── Permanent canvas label on each shape ───────────────────────────────────
function makeLabelEl(): LabelEl {
  const g   = document.createElementNS(NS, 'g') as SVGGElement;
  g.style.pointerEvents = 'none';
  const bg  = document.createElementNS(NS, 'rect') as SVGRectElement;
  bg.setAttribute('fill', 'rgba(255,255,255,0.82)');
  bg.setAttribute('rx', '3');
  const tx1 = document.createElementNS(NS, 'text') as SVGTextElement;
  const tx2 = document.createElementNS(NS, 'text') as SVGTextElement;
  for (const tx of [tx1, tx2]) {
    tx.setAttribute('font-size', '10');
    tx.setAttribute('font-family', 'system-ui,sans-serif');
    tx.setAttribute('fill', '#333');
    tx.setAttribute('text-anchor', 'middle');
    tx.setAttribute('dominant-baseline', 'middle');
  }
  g.appendChild(bg); g.appendChild(tx1); g.appendChild(tx2);
  labelLayer.appendChild(g);
  return { g, bg, tx1, tx2 };
}

function updateLabelEl(d: ShapeData): void {
  if (!d.labelEl) return;
  const { bg, tx1, tx2 } = d.labelEl;
  const { x: cx, y: cy } = shapeCentroid(d);

  const count = d.plantMarkers.length;
  const line1 = count > 0
    ? count + (count === 1 ? ' plant' : ' plants')
    : fmt(calcArea(d)) + ' m²';

  const pad = 4, lineH = 13;
  const totalH = lineH + pad * 2;
  const totalW = line1.length * 6 + pad * 2;

  tx1.textContent = line1;
  tx1.setAttribute('x', String(cx));
  tx1.setAttribute('y', String(cy));
  tx1.setAttribute('font-weight', count > 0 ? '600' : 'normal');
  tx2.textContent = '';
  tx2.style.display = 'none';

  bg.setAttribute('width',  String(totalW));
  bg.setAttribute('height', String(totalH));
  bg.setAttribute('x', String(cx - totalW / 2));
  bg.setAttribute('y', String(cy - totalH / 2));
}

function removeLabelEl(d: ShapeData): void {
  if (d.labelEl) { d.labelEl.g.remove(); d.labelEl = null; }
}

// ── Marker creation ────────────────────────────────────────────────────────
function createMarkerEl(plant: Plant, x: number, y: number): SVGGElement {
  const g = document.createElementNS(NS, 'g') as SVGGElement;
  g.dataset['marker'] = '1';
  g.style.cursor = 'pointer';

  const isDark = plant.color !== '#e0e0e0' && plant.color !== '#ffca28';
  const textFill    = isDark ? '#fff' : '#555';
  const strokeColor = isDark ? '#fff' : '#aaa';

  const ring = document.createElementNS(NS, 'circle') as SVGCircleElement;
  ring.setAttribute('cx', String(x));
  ring.setAttribute('cy', String(y));
  ring.setAttribute('r', String((plant.spacing / 2) * SCALE));
  ring.setAttribute('fill', 'none');
  ring.setAttribute('stroke', plant.color);
  ring.setAttribute('stroke-width', '1');
  ring.setAttribute('stroke-dasharray', '4 3');
  ring.setAttribute('opacity', '0.5');
  ring.style.pointerEvents = 'none';
  ring.classList.add('spacing-ring');

  const circle = document.createElementNS(NS, 'circle') as SVGCircleElement;
  circle.setAttribute('cx', String(x));
  circle.setAttribute('cy', String(y));
  circle.setAttribute('r', '8');
  circle.setAttribute('fill', plant.color);
  circle.setAttribute('stroke', strokeColor);
  circle.setAttribute('stroke-width', '1.5');

  const text = document.createElementNS(NS, 'text') as SVGTextElement;
  text.setAttribute('x', String(x));
  text.setAttribute('y', String(y));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'middle');
  text.setAttribute('font-size', '7');
  text.setAttribute('font-weight', '700');
  text.setAttribute('font-family', 'system-ui,sans-serif');
  text.setAttribute('fill', textFill);
  text.style.pointerEvents = 'none';
  text.textContent = plant.name.charAt(0).toUpperCase();

  g.appendChild(ring);
  g.appendChild(circle);
  g.appendChild(text);
  markersLayer.appendChild(g);
  return g;
}

// ── Info panel ─────────────────────────────────────────────────────────────
function updateInfoPanel(d: ShapeData | null): void {
  if (!d) {
    infoContent.innerHTML = '<div class="info-empty">No shape selected.</div>';
    deleteBtn.disabled = true;
    return;
  }
  deleteBtn.disabled = false;

  const area = calcArea(d);
  let dimRows = '';

  if (d.type === 'rect') {
    dimRows = `
      <div class="info-row">
        <span class="info-label">Type</span><span class="info-value">Rectangle</span>
      </div>
      <div class="info-row">
        <span class="info-label">Width</span><span class="info-value">${fmt(pxToM(d.w))} m</span>
      </div>
      <div class="info-row">
        <span class="info-label">Height</span><span class="info-value">${fmt(pxToM(d.h))} m</span>
      </div>`;
  } else if (d.type === 'circle') {
    dimRows = `
      <div class="info-row">
        <span class="info-label">Type</span><span class="info-value">Circle</span>
      </div>
      <div class="info-row">
        <span class="info-label">Radius</span><span class="info-value">${fmt(pxToM(d.r))} m</span>
      </div>
      <div class="info-row">
        <span class="info-label">Diameter</span><span class="info-value">${fmt(pxToM(d.r) * 2)} m</span>
      </div>`;
  } else if (d.type === 'ellipse') {
    dimRows = `
      <div class="info-row">
        <span class="info-label">Type</span><span class="info-value">Ellipse</span>
      </div>
      <div class="info-row">
        <span class="info-label">Width</span><span class="info-value">${fmt(pxToM(d.rx) * 2)} m</span>
      </div>
      <div class="info-row">
        <span class="info-label">Height</span><span class="info-value">${fmt(pxToM(d.ry) * 2)} m</span>
      </div>`;
  }

  const count = d.plantMarkers.length;
  const countHTML = count > 0
    ? `<div class="plant-count-row">
         <span class="plant-count-label">Plants placed</span>
         <span class="plant-count-value">${count}</span>
       </div>`
    : `<div class="info-hint" style="margin-top:6px;">Drag a plant from the left panel onto this bed.</div>`;

  infoContent.innerHTML = `
    ${dimRows}
    <hr class="info-divider">
    <div class="info-area">Area: ${fmt(area)} m²</div>
    ${countHTML}
  `;
}

// ── Plant summary ──────────────────────────────────────────────────────────
function updateSummary(): void {
  const totals: Record<string, { count: number; color: string }> = {};
  for (const d of shapes) {
    for (const m of d.plantMarkers) {
      const n = m.plant.name;
      if (!totals[n]) totals[n] = { count: 0, color: m.plant.color };
      totals[n].count++;
    }
  }
  const entries = Object.entries(totals);
  if (entries.length === 0) {
    summaryContent.innerHTML = '<div class="info-empty">No plants placed yet.</div>';
    return;
  }
  let grandTotal = 0;
  let html = '';
  for (const [name, { count, color }] of entries) {
    grandTotal += count;
    html += `<div class="summary-row">
      <span class="summary-name">
        <span class="summary-swatch" style="background:${color}"></span>${name}
      </span>
      <span class="summary-count">${count}</span>
    </div>`;
  }
  html += `<hr class="info-divider">
    <div class="summary-row summary-total">
      <span>Total</span>
      <span class="summary-count">${grandTotal}</span>
    </div>`;
  summaryContent.innerHTML = html;
}

// ── Selection ──────────────────────────────────────────────────────────────
const SEL_STROKE = '#1565c0';
const SEL_SW     = '3';
const DEF_SW     = '1.5';

function selectShape(d: ShapeData | null): void {
  if (selectedData) {
    selectedData.el.setAttribute('stroke', selectedData.stroke);
    selectedData.el.setAttribute('stroke-width', DEF_SW);
  }
  selectedData = d;
  if (d) {
    d.el.setAttribute('stroke', SEL_STROKE);
    d.el.setAttribute('stroke-width', SEL_SW);
  }
  updateInfoPanel(d);
}

function findShapeByEl(el: Element): ShapeData | null {
  return shapes.find(s => s.el === el) ?? null;
}

// ── Deletion ───────────────────────────────────────────────────────────────
function deleteSelected(): void {
  if (!selectedData) return;
  for (const m of selectedData.plantMarkers) m.el.remove();
  selectedData.el.remove();
  removeLabelEl(selectedData);
  shapes = shapes.filter(s => s !== selectedData);
  selectedData = null;
  updateInfoPanel(null);
  updateSummary();
}

deleteBtn.addEventListener('click', deleteSelected);

// ── CC spacing rings toggle ────────────────────────────────────────────────
const ringsToggle = document.getElementById('rings-toggle') as HTMLInputElement;
ringsToggle.addEventListener('change', () => {
  document.body.classList.toggle('hide-rings', !ringsToggle.checked);
});

// ── Tool switching ─────────────────────────────────────────────────────────
function setTool(name: Tool): void {
  currentTool = name;
  document.querySelectorAll('.tool-btn').forEach(b => {
    (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset['tool'] === name);
  });
  svgEl.className.baseVal = name === 'select' ? 'tool-select' : 'tool-draw';
  statusMsg.textContent = '';
}

document.querySelectorAll('.tool-btn').forEach(b => {
  b.addEventListener('click', () => setTool((b as HTMLElement).dataset['tool'] as Tool));
});

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); return; }
  if (e.key === 's' || e.key === 'S') setTool('select');
  if (e.key === 'r' || e.key === 'R') setTool('rect');
  if (e.key === 'c' || e.key === 'C') setTool('circle');
  if (e.key === 'e' || e.key === 'E') setTool('ellipse');
});

// ── Plant palette (left panel) ─────────────────────────────────────────────
function renderPlantList(): void {
  PLANTS.forEach((plant, i) => {
    const chip = document.createElement('div');
    chip.className = 'plant-chip';
    chip.draggable = true;
    chip.innerHTML = `
      <span class="chip-swatch" style="background:${plant.color}"></span>
      <span>${plant.name} (${plant.spacing} m)</span>
    `;
    chip.addEventListener('dragstart', (e: DragEvent) => {
      e.dataTransfer!.setData('plantIndex', String(i));
      e.dataTransfer!.effectAllowed = 'copy';
      chip.classList.add('dragging');
    });
    chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
    plantListEl.appendChild(chip);
  });
}

// ── Drag-and-drop onto SVG ─────────────────────────────────────────────────
function svgCoords(e: MouseEvent): { x: number; y: number } {
  const rect = svgEl.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

svgEl.addEventListener('dragover', (e: DragEvent) => {
  if (!e.dataTransfer!.types.includes('plantindex')) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'copy';
});

svgEl.addEventListener('drop', (e: DragEvent) => {
  e.preventDefault();
  const idx = parseInt(e.dataTransfer!.getData('plantIndex'));
  if (isNaN(idx) || idx < 0 || idx >= PLANTS.length) return;

  const { x, y } = svgCoords(e);

  let targetShape: ShapeData | null = null;
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (pointInShape(shapes[i], x, y)) { targetShape = shapes[i]; break; }
  }
  if (!targetShape) return;

  const plant = PLANTS[idx];
  const markerEl = createMarkerEl(plant, x, y);
  const marker: PlantMarker = { plant, x, y, el: markerEl };
  targetShape.plantMarkers.push(marker);

  updateLabelEl(targetShape);
  if (selectedData === targetShape) updateInfoPanel(targetShape);
  updateSummary();
});

// ── Marker click-to-delete ─────────────────────────────────────────────────
markersLayer.addEventListener('click', (e: MouseEvent) => {
  if (currentTool !== 'select') return;
  const markerGroup = (e.target as Element).closest('[data-marker]') as SVGGElement | null;
  if (!markerGroup) return;
  e.stopPropagation();

  for (const d of shapes) {
    const idx = d.plantMarkers.findIndex(m => m.el === markerGroup);
    if (idx !== -1) {
      markerGroup.remove();
      d.plantMarkers.splice(idx, 1);
      updateLabelEl(d);
      if (selectedData === d) updateInfoPanel(d);
      updateSummary();
      return;
    }
  }
});

// ── Drawing ────────────────────────────────────────────────────────────────
function nextColor(): { fill: string; stroke: string } {
  const i = colorIndex % FILL_COLORS.length;
  colorIndex++;
  return { fill: FILL_COLORS[i], stroke: STROKE_COLORS[i] };
}

svgEl.addEventListener('mousedown', (e: MouseEvent) => {
  if ((e.target as Element).closest('[data-marker]')) return;

  if (currentTool === 'select') {
    const hit = (e.target as Element).closest('[data-shape]');
    selectShape(hit ? findShapeByEl(hit) : null);
    return;
  }

  const p = svgCoords(e);
  startX = p.x; startY = p.y;
  drawing = true;

  const { fill, stroke } = nextColor();

  if (currentTool === 'rect') {
    activeEl = document.createElementNS(NS, 'rect') as SVGRectElement;
    activeEl.setAttribute('x', String(startX)); activeEl.setAttribute('y', String(startY));
    activeEl.setAttribute('width', '0');  activeEl.setAttribute('height', '0');
  } else if (currentTool === 'circle') {
    activeEl = document.createElementNS(NS, 'circle') as SVGCircleElement;
    activeEl.setAttribute('cx', String(startX)); activeEl.setAttribute('cy', String(startY));
    activeEl.setAttribute('r', '0');
  } else if (currentTool === 'ellipse') {
    activeEl = document.createElementNS(NS, 'ellipse') as SVGEllipseElement;
    activeEl.setAttribute('cx', String(startX)); activeEl.setAttribute('cy', String(startY));
    activeEl.setAttribute('rx', '0'); activeEl.setAttribute('ry', '0');
  }

  if (!activeEl) return;
  activeEl.setAttribute('fill', fill);
  activeEl.setAttribute('stroke', stroke);
  activeEl.setAttribute('stroke-width', DEF_SW);
  (activeEl as SVGElement & { dataset: DOMStringMap }).dataset['shape'] = '1';
  activeEl.style.cursor = 'pointer';
  (activeEl as SVGElement & Record<string, string>)['_fill']   = fill;
  (activeEl as SVGElement & Record<string, string>)['_stroke'] = stroke;

  shapesLayer.appendChild(activeEl);
  e.preventDefault();
});

svgEl.addEventListener('mousemove', (e: MouseEvent) => {
  if (!drawing || !activeEl) return;
  const p = svgCoords(e);

  if (currentTool === 'rect') {
    const x = Math.min(startX, p.x), y = Math.min(startY, p.y);
    const w = Math.abs(p.x - startX),  h = Math.abs(p.y - startY);
    activeEl.setAttribute('x', String(x)); activeEl.setAttribute('y', String(y));
    activeEl.setAttribute('width', String(w)); activeEl.setAttribute('height', String(h));
    updateDimLabel(x + w / 2, y - 12, `${fmt(pxToM(w))} × ${fmt(pxToM(h))} m`);

  } else if (currentTool === 'circle') {
    const dx = p.x - startX, dy = p.y - startY;
    const r = Math.sqrt(dx * dx + dy * dy);
    activeEl.setAttribute('r', String(r));
    updateDimLabel(startX, startY - r - 14, `r = ${fmt(pxToM(r))} m`);

  } else if (currentTool === 'ellipse') {
    const rx = Math.abs(p.x - startX) / 2, ry = Math.abs(p.y - startY) / 2;
    const cx = (startX + p.x) / 2,          cy = (startY + p.y) / 2;
    activeEl.setAttribute('cx', String(cx)); activeEl.setAttribute('cy', String(cy));
    activeEl.setAttribute('rx', String(rx)); activeEl.setAttribute('ry', String(ry));
    updateDimLabel(cx, cy - ry - 14, `${fmt(pxToM(rx * 2))} × ${fmt(pxToM(ry * 2))} m`);
  }
});

document.addEventListener('mouseup', () => {
  if (!drawing || !activeEl) return;
  drawing = false;
  hideDimLabel();

  let d: ShapeData | null = null;
  const el = activeEl;
  const fill  = (el as SVGElement & Record<string, string>)['_fill'];
  const stroke = (el as SVGElement & Record<string, string>)['_stroke'];

  if (currentTool === 'rect') {
    const w = parseFloat(el.getAttribute('width')  ?? '0') || 0;
    const h = parseFloat(el.getAttribute('height') ?? '0') || 0;
    if (w < 4 || h < 4) { el.remove(); activeEl = null; return; }
    d = {
      type: 'rect',
      el: el as SVGGeometryElement,
      labelEl: null,
      plantMarkers: [],
      x: parseFloat(el.getAttribute('x') ?? '0'),
      y: parseFloat(el.getAttribute('y') ?? '0'),
      w, h, fill, stroke,
    };

  } else if (currentTool === 'circle') {
    const r = parseFloat(el.getAttribute('r') ?? '0') || 0;
    if (r < 4) { el.remove(); activeEl = null; return; }
    d = {
      type: 'circle',
      el: el as SVGGeometryElement,
      labelEl: null,
      plantMarkers: [],
      cx: parseFloat(el.getAttribute('cx') ?? '0'),
      cy: parseFloat(el.getAttribute('cy') ?? '0'),
      r, fill, stroke,
    };

  } else if (currentTool === 'ellipse') {
    const rx = parseFloat(el.getAttribute('rx') ?? '0') || 0;
    const ry = parseFloat(el.getAttribute('ry') ?? '0') || 0;
    if (rx < 4 || ry < 4) { el.remove(); activeEl = null; return; }
    d = {
      type: 'ellipse',
      el: el as SVGGeometryElement,
      labelEl: null,
      plantMarkers: [],
      cx: parseFloat(el.getAttribute('cx') ?? '0'),
      cy: parseFloat(el.getAttribute('cy') ?? '0'),
      rx, ry, fill, stroke,
    };
  }

  if (!d) { activeEl = null; return; }

  d.labelEl = makeLabelEl();
  updateLabelEl(d);
  shapes.push(d);
  activeEl = null;

  setTool('select');
  selectShape(d);
});

// ── Init ───────────────────────────────────────────────────────────────────
drawGrid();
renderPlantList();
setTool('select');
