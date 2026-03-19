import * as XLSX from 'xlsx';
import { searchPlants, isKnownPlantName } from './search';
import { getOverride, setOverride } from './plantStore';
import { summaryDisplayName, aggregatePlantCounts } from './summary';
import {
  NS,
  FLOWER_RADIUS,
  TREE_RADIUS,
  buildMarkerEl,
  showMarkerSelection,
  hideMarkerSelection,
  applyOverrideToEl,
} from './markers';

import { buildChipEl } from './chips';
import { buildExportRows } from './export';
import {
  applyRingsToggle,
  applyGridToggle,
  applyBgToggle,
  applyFlowersToggle,
  applyTreesToggle,
} from './toggles';
import { applyTooltipContent, clearTooltipHandlers } from './tooltip';
import { validateCustomPlantInput } from './customPlantForm';
import { buildSaveData, parseSaveData } from './saveload';
import type { SavedShape, SaveData } from './saveload';
import { getAllOverrides, restoreOverrides } from './plantStore';
import {
  getCustomPlants,
  addCustomPlant,
  updateCustomPlant,
  removeCustomPlant,
  subscribe as subscribeCustomPlants,
  getAllCustomPlants,
  restoreCustomPlants,
  isNameAvailable,
} from './customPlants';
import {
  SCALE,
  CANVAS_W,
  CANVAS_H,
  pxToM,
  fmt,
  calcArea,
  pointInShape,
  calcScale,
  polygonSelfIntersects,
  calcFillCount,
  computeFillPositions,
  calcZoomLimits,
  rulerTicks,
} from './geometry';
import type { ShapeData, PlantMarker, Plant, PolygonShape } from './types';

// ── Constants ──────────────────────────────────────────────────────────────
const SNAP_RADIUS = 12; // px — distance within which cursor snaps to first polygon vertex

const FILL_COLORS: string[] = ['rgba(200,200,200,0.25)'];
const STROKE_COLORS: string[] = ['#999'];
let colorIndex = 0;

// ── DOM refs ───────────────────────────────────────────────────────────────
const svgEl = document.getElementById('canvas') as unknown as SVGSVGElement;
const bgLayer = document.getElementById('bg-layer') as unknown as SVGGElement;
const shapesLayer = document.getElementById('shapes-layer') as unknown as SVGGElement;
const flowersLayer = document.getElementById('flowers-layer') as unknown as SVGGElement;
const treesLayer = document.getElementById('trees-layer') as unknown as SVGGElement;
const overlayLayer = document.getElementById('overlay-layer') as unknown as SVGGElement;
const hRuler = document.getElementById('h-ruler') as HTMLCanvasElement;
const vRuler = document.getElementById('v-ruler') as HTMLCanvasElement;
const shapeTooltipEl = document.getElementById('shape-tooltip') as HTMLDivElement;
const summaryContent = document.getElementById('summary-content') as HTMLDivElement;
const statusMsg = document.getElementById('status-msg') as HTMLSpanElement;
const importBgBtn = document.getElementById('import-bg-btn') as HTMLButtonElement;
const bgFileInput = document.getElementById('bg-file-input') as HTMLInputElement;
const calibOverlay = document.getElementById('calib-overlay') as HTMLDivElement;
const calibInput = document.getElementById('calib-input') as HTMLInputElement;
const calibOkBtn = document.getElementById('calib-ok') as HTMLButtonElement;
const calibCancelBtn = document.getElementById('calib-cancel') as HTMLButtonElement;
const scaleInfo = document.getElementById('scale-info') as HTMLSpanElement;

// ── State ──────────────────────────────────────────────────────────────────
type Tool = 'select' | 'rect' | 'circle' | 'ellipse' | 'polygon' | 'calibrate';
let currentTool: Tool = 'select';
let drawing = false;
let startX = 0;
let startY = 0;
let activeEl: SVGElement | null = null;
let selectedData: ShapeData | null = null;
let shapes: ShapeData[] = [];

// Fill mode — toggled via toolbar button, resets to false after each successful drop
let fillMode = false;

// Polygon drawing state
let polyPts: Array<{ x: number; y: number }> = [];
let polyVertexDots: SVGCircleElement[] = [];
let polySegments: SVGLineElement[] = [];
let polyPreviewLine: SVGLineElement | null = null;

// Phase 3 — background image & scale calibration
let sessionScale = SCALE;
let bgImageEl: SVGImageElement | null = null;
let bgX = 0,
  bgY = 0;
let calibPts: Array<{ x: number; y: number }> = [];
let calibMarkers: SVGCircleElement[] = [];
let calibLineEl: SVGLineElement | null = null;
let movingBg = false;
let moveBgStartX = 0,
  moveBgStartY = 0;
let moveBgOrigX = 0,
  moveBgOrigY = 0;

// Marker selection
let selectedMarker: PlantMarker | null = null;
let selectedMarkerShape: ShapeData | null = null;

// Shape / marker dragging
let draggingShape: ShapeData | null = null;
let draggingMarker: PlantMarker | null = null;
let dragMouseStartX = 0,
  dragMouseStartY = 0;
// Snapshot of shape origin at drag start (type-specific)
let dragShapeOrigRectX = 0,
  dragShapeOrigRectY = 0;
let dragShapeOrigCx = 0,
  dragShapeOrigCy = 0;
let dragShapeOrigPoints: Array<{ x: number; y: number }> = [];
let dragShapeMarkersOrig: Array<{ x: number; y: number }> = [];
// Snapshot of marker origin at drag start
let dragMarkerOrigX = 0,
  dragMarkerOrigY = 0;

// ── Zoom / pan state ────────────────────────────────────────────────────────
let vbX = 0,
  vbY = 0,
  vbW = CANVAS_W,
  vbH = CANVAS_H;
let panning = false;
let panStartX = 0,
  panStartY = 0; // screen px at pan start
let panVbStartX = 0,
  panVbStartY = 0; // viewBox origin at pan start
let spaceDown = false;

// ── Grid ───────────────────────────────────────────────────────────────────
function drawGrid(scale = SCALE): void {
  const g = document.getElementById('grid-layer') as unknown as SVGGElement;
  g.innerHTML = '';

  const major = scale; // 1 m in SVG units
  const minor = scale / 2; // 0.5 m
  const showMinor = scale >= 50;
  const BIG = 100_000; // large enough to cover any pan/zoom

  // Build pattern(s) in a <defs> block
  const defs = document.createElementNS(NS, 'defs');

  function makeLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    stroke: string,
    sw: number,
  ): SVGLineElement {
    const ln = document.createElementNS(NS, 'line') as SVGLineElement;
    ln.setAttribute('x1', String(x1));
    ln.setAttribute('y1', String(y1));
    ln.setAttribute('x2', String(x2));
    ln.setAttribute('y2', String(y2));
    ln.setAttribute('stroke', stroke);
    ln.setAttribute('stroke-width', String(sw));
    return ln;
  }

  if (showMinor) {
    const mp = document.createElementNS(NS, 'pattern') as SVGPatternElement;
    mp.setAttribute('id', 'grid-minor-pat');
    mp.setAttribute('width', String(minor));
    mp.setAttribute('height', String(minor));
    mp.setAttribute('patternUnits', 'userSpaceOnUse');
    mp.appendChild(makeLine(minor, 0, minor, minor, '#e8f0e4', 0.5));
    mp.appendChild(makeLine(0, minor, minor, minor, '#e8f0e4', 0.5));
    defs.appendChild(mp);
  }

  const Mp = document.createElementNS(NS, 'pattern') as SVGPatternElement;
  Mp.setAttribute('id', 'grid-major-pat');
  Mp.setAttribute('width', String(major));
  Mp.setAttribute('height', String(major));
  Mp.setAttribute('patternUnits', 'userSpaceOnUse');
  if (showMinor) {
    const minorRect = document.createElementNS(NS, 'rect') as SVGRectElement;
    minorRect.setAttribute('width', String(major));
    minorRect.setAttribute('height', String(major));
    minorRect.setAttribute('fill', 'url(#grid-minor-pat)');
    Mp.appendChild(minorRect);
  }
  Mp.appendChild(makeLine(major, 0, major, major, '#c8d8c0', 1));
  Mp.appendChild(makeLine(0, major, major, major, '#c8d8c0', 1));
  defs.appendChild(Mp);

  g.appendChild(defs);

  // Single rect filled with the tiling pattern — covers all pan/zoom positions
  const rect = document.createElementNS(NS, 'rect') as SVGRectElement;
  rect.setAttribute('x', String(-BIG));
  rect.setAttribute('y', String(-BIG));
  rect.setAttribute('width', String(BIG * 2));
  rect.setAttribute('height', String(BIG * 2));
  rect.setAttribute('fill', 'url(#grid-major-pat)');
  g.appendChild(rect);
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
  const g = document.createElementNS(NS, 'g') as SVGGElement;
  const bg = document.createElementNS(NS, 'rect') as SVGRectElement;
  bg.setAttribute('fill', 'rgba(0,0,0,0.65)');
  bg.setAttribute('rx', '3');
  const tx = document.createElementNS(NS, 'text') as SVGTextElement;
  tx.setAttribute('fill', '#fff');
  tx.setAttribute('font-size', '11');
  tx.setAttribute('font-family', 'system-ui,sans-serif');
  tx.setAttribute('text-anchor', 'middle');
  tx.setAttribute('dominant-baseline', 'middle');
  g.appendChild(bg);
  g.appendChild(tx);
  overlayLayer.appendChild(g);
  dimLabel = { g, bg, tx };
}

function updateDimLabel(x: number, y: number, text: string): void {
  ensureDimLabel();
  const d = dimLabel!;
  const pad = 5,
    h = 18;
  const w = text.length * 6.2 + pad * 2;
  d.tx.textContent = text;
  d.bg.setAttribute('width', String(w));
  d.bg.setAttribute('height', String(h));
  d.bg.setAttribute('x', String(x - w / 2));
  d.bg.setAttribute('y', String(y - h / 2));
  d.tx.setAttribute('x', String(x));
  d.tx.setAttribute('y', String(y));
  d.g.style.display = '';
}

function hideDimLabel(): void {
  if (dimLabel) dimLabel.g.style.display = 'none';
}

// ── Permanent canvas label on each shape ───────────────────────────────────

// ── Marker creation ────────────────────────────────────────────────────────
function createMarkerEl(plant: Plant, x: number, y: number): SVGGElement {
  const g = buildMarkerEl(plant, x, y, sessionScale);
  if (plant.image_url || plant.scientific_name) {
    g.addEventListener('mouseenter', () => showImgTooltip(plant, g));
    g.addEventListener('mouseleave', hideImgTooltip);
  }
  (plant.icon === 'tree' ? treesLayer : flowersLayer).appendChild(g);
  return g;
}

// ── Shape tooltip ───────────────────────────────────────────────────────────
function buildShapeTooltipHTML(d: ShapeData): string {
  const area = calcArea(d, sessionScale);
  const dimRows =
    d.type === 'rect'
      ? `<div class="info-row"><span class="info-label">Type</span><span class="info-value">Rectangle</span></div>
      <div class="info-row"><span class="info-label">Width</span><span class="info-value">${fmt(pxToM(d.w, sessionScale))} m</span></div>
      <div class="info-row"><span class="info-label">Height</span><span class="info-value">${fmt(pxToM(d.h, sessionScale))} m</span></div>`
      : d.type === 'circle'
        ? `<div class="info-row"><span class="info-label">Type</span><span class="info-value">Circle</span></div>
      <div class="info-row"><span class="info-label">Radius</span><span class="info-value">${fmt(pxToM(d.r, sessionScale))} m</span></div>
      <div class="info-row"><span class="info-label">Diameter</span><span class="info-value">${fmt(pxToM(d.r, sessionScale) * 2)} m</span></div>`
        : d.type === 'ellipse'
          ? `<div class="info-row"><span class="info-label">Type</span><span class="info-value">Ellipse</span></div>
      <div class="info-row"><span class="info-label">Width</span><span class="info-value">${fmt(pxToM(d.rx, sessionScale) * 2)} m</span></div>
      <div class="info-row"><span class="info-label">Height</span><span class="info-value">${fmt(pxToM(d.ry, sessionScale) * 2)} m</span></div>`
          : `<div class="info-row"><span class="info-label">Type</span><span class="info-value">Polygon</span></div>
      <div class="info-row"><span class="info-label">Vertices</span><span class="info-value">${d.points.length}</span></div>`;

  const count = d.plantMarkers.length;
  const countHTML =
    count > 0
      ? `<div class="plant-count-row"><span class="plant-count-label">Plants placed</span><span class="plant-count-value">${count}</span></div>`
      : `<div class="info-hint" style="margin-top:4px;">Drag a plant onto this bed.</div>`;

  return `${dimRows}<hr class="info-divider"><div class="info-area">Area: ${fmt(area)} m²</div>${countHTML}`;
}

function positionShapeTooltip(e: MouseEvent): void {
  const tipW = shapeTooltipEl.offsetWidth || 180;
  const left = e.clientX + 14 + tipW > window.innerWidth ? e.clientX - tipW - 14 : e.clientX + 14;
  shapeTooltipEl.style.left = left + 'px';
  shapeTooltipEl.style.top = Math.min(e.clientY - 10, window.innerHeight - 150) + 'px';
}

function hideShapeTooltip(): void {
  shapeTooltipEl.style.display = 'none';
}

let detachShapeTooltip: (() => void) | null = null;

function attachShapeTooltipHandlers(d: ShapeData): void {
  if (detachShapeTooltip) detachShapeTooltip();
  const onEnter = (e: MouseEvent) => {
    if (selectedData !== d) return;
    shapeTooltipEl.innerHTML = buildShapeTooltipHTML(d);
    shapeTooltipEl.style.display = 'block';
    positionShapeTooltip(e);
  };
  const onMove = (e: MouseEvent) => positionShapeTooltip(e);
  const onLeave = () => hideShapeTooltip();
  d.el.addEventListener('mouseenter', onEnter);
  d.el.addEventListener('mousemove', onMove);
  d.el.addEventListener('mouseleave', onLeave);
  detachShapeTooltip = () => {
    d.el.removeEventListener('mouseenter', onEnter);
    d.el.removeEventListener('mousemove', onMove);
    d.el.removeEventListener('mouseleave', onLeave);
  };
}

// ── Plant summary ──────────────────────────────────────────────────────────
function renderUsedPlants(): void {
  const section = document.getElementById('used-plants-section') as HTMLDivElement;
  const el = document.getElementById('used-plants') as HTMLDivElement;
  // Collect unique plants by name, preserving first-seen order
  const seen = new Map<string, Plant>();
  for (const d of shapes) {
    for (const m of d.plantMarkers) {
      const key = m.plant.slug ?? m.plant.scientific_name ?? m.plant.name;
      if (!seen.has(key)) seen.set(key, m.plant);
    }
  }
  if (seen.size === 0) {
    el.innerHTML = '';
    return;
  }
  section.style.display = 'flex';
  el.innerHTML = '';
  seen.forEach((plant) => el.appendChild(makeChip(plant)));
}

function updateSummary(): void {
  const totals = aggregatePlantCounts(shapes);
  renderUsedPlants();
  if (totals.size === 0) {
    summaryContent.innerHTML = '<div class="info-empty">No plants placed yet.</div>';
    return;
  }
  summaryContent.innerHTML = '';
  let grandTotal = 0;
  for (const { count, plant } of totals.values()) {
    grandTotal += count;
    const displayName = summaryDisplayName(plant);
    const row = document.createElement('div');
    row.className = 'summary-row';
    row.innerHTML = `
      <span class="summary-name">
        <span class="summary-swatch" style="background:${plant.color}"></span>${displayName}
      </span>
      <span class="summary-count">${count}</span>`;
    if (plant.image_url || plant.scientific_name) {
      row.addEventListener('mouseenter', () => showImgTooltip(plant, row));
      row.addEventListener('mouseleave', hideImgTooltip);
    }
    summaryContent.appendChild(row);
  }
  const divider = document.createElement('hr');
  divider.className = 'info-divider';
  summaryContent.appendChild(divider);
  const total = document.createElement('div');
  total.className = 'summary-row summary-total';
  total.innerHTML = `<span>Total</span><span class="summary-count">${grandTotal}</span>`;
  summaryContent.appendChild(total);
}

// ── Selection ──────────────────────────────────────────────────────────────
const SEL_STROKE = '#1565c0';
const SEL_SW = '3';
const DEF_SW = '1.5';

function deselectMarker(): void {
  if (!selectedMarker) return;
  hideMarkerSelection(selectedMarker.el);
  selectedMarker = null;
  selectedMarkerShape = null;
}

function selectMarker(m: PlantMarker, shape: ShapeData): void {
  deselectMarker();
  // Deselect any active shape
  if (selectedData) {
    selectedData.el.setAttribute('stroke', selectedData.stroke);
    selectedData.el.setAttribute('stroke-width', DEF_SW);
    selectedData = null;
  }
  selectedMarker = m;
  selectedMarkerShape = shape;
  showMarkerSelection(m.el);
}

function selectShape(d: ShapeData | null): void {
  deselectMarker();
  if (selectedData) {
    selectedData.el.setAttribute('stroke', selectedData.stroke);
    selectedData.el.setAttribute('stroke-width', DEF_SW);
  }
  if (detachShapeTooltip) {
    detachShapeTooltip();
    detachShapeTooltip = null;
  }
  hideShapeTooltip();
  selectedData = d;
  if (d) {
    d.el.setAttribute('stroke', SEL_STROKE);
    d.el.setAttribute('stroke-width', SEL_SW);
    attachShapeTooltipHandlers(d);
  }
}

// ── Drag helpers ────────────────────────────────────────────────────────────
function moveMarkerEl(m: PlantMarker, x: number, y: number): void {
  m.x = x;
  m.y = y;
  m.el.querySelectorAll('circle').forEach((c) => {
    c.setAttribute('cx', String(x));
    c.setAttribute('cy', String(y));
  });
  const ringR = (m.plant.spacing / 2) * sessionScale;
  const dotR = ringR * 0.45;
  const flowerG = m.el.querySelector('.flower-icon') as SVGGElement | null;
  if (flowerG) {
    const s = dotR / FLOWER_RADIUS;
    flowerG.setAttribute('transform', `translate(${x},${y}) scale(${s}) translate(-300,-300)`);
  }
  const treeG = m.el.querySelector('.tree-icon') as SVGGElement | null;
  if (treeG) {
    const s = dotR / TREE_RADIUS;
    treeG.setAttribute('transform', `translate(${x},${y}) scale(${s}) translate(-355.5,-140.3)`);
  }
  const selCircle = m.el.querySelector('.sel-circle') as SVGCircleElement | null;
  if (selCircle) selCircle.setAttribute('r', String(dotR * 1.3));
}

function moveShapeTo(d: ShapeData, dx: number, dy: number): void {
  if (d.type === 'rect') {
    const x = dragShapeOrigRectX + dx,
      y = dragShapeOrigRectY + dy;
    d.el.setAttribute('x', String(x));
    d.el.setAttribute('y', String(y));
    d.x = x;
    d.y = y;
  } else if (d.type === 'circle' || d.type === 'ellipse') {
    const cx = dragShapeOrigCx + dx,
      cy = dragShapeOrigCy + dy;
    d.el.setAttribute('cx', String(cx));
    d.el.setAttribute('cy', String(cy));
    d.cx = cx;
    d.cy = cy;
  } else if (d.type === 'polygon') {
    const pts = dragShapeOrigPoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    d.el.setAttribute('points', pts.map((p) => `${p.x},${p.y}`).join(' '));
    d.points = pts;
  }
  d.plantMarkers.forEach((m, i) => {
    const o = dragShapeMarkersOrig[i];
    moveMarkerEl(m, o.x + dx, o.y + dy);
  });
}

function findShapeByEl(el: Element): ShapeData | null {
  return shapes.find((s) => s.el === el) ?? null;
}

// ── Deletion ───────────────────────────────────────────────────────────────
function deleteSelected(): void {
  if (selectedMarker && selectedMarkerShape) {
    selectedMarker.el.remove();
    const idx = selectedMarkerShape.plantMarkers.indexOf(selectedMarker);
    if (idx !== -1) selectedMarkerShape.plantMarkers.splice(idx, 1);
    updateSummary();
    deselectMarker();
    return;
  }
  if (!selectedData) return;
  if (!confirm('Delete this shape and all its plants?')) return;
  for (const m of selectedData.plantMarkers) m.el.remove();
  selectedData.el.remove();
  shapes = shapes.filter((s) => s !== selectedData);
  selectedData = null;

  updateSummary();
}

// ── Fill mode toggle ───────────────────────────────────────────────────────
const fillModeCheck = document.getElementById('fill-mode-check') as HTMLInputElement;
fillModeCheck.addEventListener('change', () => {
  fillMode = fillModeCheck.checked;
});

// ── Visibility toggles ─────────────────────────────────────────────────────
const ringsToggle = document.getElementById('rings-toggle') as HTMLInputElement;
ringsToggle.addEventListener('change', () => applyRingsToggle(document.body, ringsToggle.checked));

const gridToggle = document.getElementById('grid-toggle') as HTMLInputElement;
gridToggle.addEventListener('change', () => applyGridToggle(document.body, gridToggle.checked));

const bgToggle = document.getElementById('bg-toggle') as HTMLInputElement;
bgToggle.addEventListener('change', () => applyBgToggle(document.body, bgToggle.checked));

const flowersToggle = document.getElementById('flowers-toggle') as HTMLInputElement;
flowersToggle.addEventListener('change', () =>
  applyFlowersToggle(document.body, flowersToggle.checked),
);

const treesToggle = document.getElementById('trees-toggle') as HTMLInputElement;
treesToggle.addEventListener('change', () => applyTreesToggle(document.body, treesToggle.checked));

// ── Polygon drawing helpers ────────────────────────────────────────────────
function clearPolygon(): void {
  for (const d of polyVertexDots) overlayLayer.removeChild(d);
  polyVertexDots = [];
  for (const s of polySegments) overlayLayer.removeChild(s);
  polySegments = [];
  if (polyPreviewLine) {
    overlayLayer.removeChild(polyPreviewLine);
    polyPreviewLine = null;
  }
  polyPts = [];
  hideDimLabel();
}

function addVertexDot(pt: { x: number; y: number }, isFirst: boolean): void {
  const c = document.createElementNS(NS, 'circle') as SVGCircleElement;
  c.setAttribute('cx', String(pt.x));
  c.setAttribute('cy', String(pt.y));
  c.setAttribute('r', '5');
  c.setAttribute('fill', isFirst ? '#fff' : '#1565c0');
  c.setAttribute('stroke', '#1565c0');
  c.setAttribute('stroke-width', '1.5');
  c.style.pointerEvents = 'none';
  overlayLayer.appendChild(c);
  polyVertexDots.push(c);
}

function drawPolySegment(p1: { x: number; y: number }, p2: { x: number; y: number }): void {
  const ln = document.createElementNS(NS, 'line') as SVGLineElement;
  ln.setAttribute('x1', String(p1.x));
  ln.setAttribute('y1', String(p1.y));
  ln.setAttribute('x2', String(p2.x));
  ln.setAttribute('y2', String(p2.y));
  ln.setAttribute('stroke', '#1565c0');
  ln.setAttribute('stroke-width', '1.5');
  ln.setAttribute('stroke-dasharray', '5,3');
  ln.style.pointerEvents = 'none';
  overlayLayer.appendChild(ln);
  polySegments.push(ln);
}

function updatePolyPreview(pt: { x: number; y: number }): void {
  if (!polyPreviewLine) {
    polyPreviewLine = document.createElementNS(NS, 'line') as SVGLineElement;
    polyPreviewLine.setAttribute('stroke', '#1565c0');
    polyPreviewLine.setAttribute('stroke-width', '1');
    polyPreviewLine.setAttribute('stroke-dasharray', '4,3');
    polyPreviewLine.setAttribute('opacity', '0.5');
    polyPreviewLine.style.pointerEvents = 'none';
    overlayLayer.appendChild(polyPreviewLine);
  }
  const last = polyPts[polyPts.length - 1];
  polyPreviewLine.setAttribute('x1', String(last.x));
  polyPreviewLine.setAttribute('y1', String(last.y));
  polyPreviewLine.setAttribute('x2', String(pt.x));
  polyPreviewLine.setAttribute('y2', String(pt.y));
}

function finalizePolygon(): void {
  if (polyPts.length < 3) return;
  if (polygonSelfIntersects(polyPts)) {
    statusMsg.textContent = 'Shape self-intersects — adjust points before closing.';
    return;
  }
  const { fill, stroke } = nextColor();
  const el = document.createElementNS(NS, 'polygon') as SVGPolygonElement;
  el.setAttribute('points', polyPts.map((p) => `${p.x},${p.y}`).join(' '));
  el.setAttribute('fill', fill);
  el.setAttribute('stroke', stroke);
  el.setAttribute('stroke-width', DEF_SW);
  (el as SVGElement & { dataset: DOMStringMap }).dataset['shape'] = '1';
  el.style.cursor = 'pointer';
  (el as unknown as Record<string, string>)['_fill'] = fill;
  (el as unknown as Record<string, string>)['_stroke'] = stroke;
  shapesLayer.appendChild(el);

  const d: PolygonShape = {
    type: 'polygon',
    el: el as SVGGeometryElement,
    plantMarkers: [],
    points: [...polyPts],
    fill,
    stroke,
  };
  shapes.push(d);

  clearPolygon();
  setTool('select');
  selectShape(d);
}

// ── Scale calibration ──────────────────────────────────────────────────────
function clearCalibration(): void {
  calibPts = [];
  for (const c of calibMarkers) overlayLayer.removeChild(c);
  calibMarkers = [];
  if (calibLineEl) {
    overlayLayer.removeChild(calibLineEl);
    calibLineEl = null;
  }
  calibOverlay.style.display = 'none';
}

function applyCalibration(): void {
  const realM = parseFloat(calibInput.value);
  if (!isNaN(realM) && realM > 0 && calibPts.length === 2) {
    sessionScale = calcScale(calibPts[0].x, calibPts[0].y, calibPts[1].x, calibPts[1].y, realM);
    scaleInfo.textContent = `Scale: 1 m = ${Math.round(sessionScale)} px`;
    drawGrid(sessionScale);
    drawRulers();
    for (const s of shapes) {
      for (const m of s.plantMarkers) {
        const ringR = (m.plant.spacing / 2) * sessionScale;
        const dotR = ringR * 0.45;
        const ring = m.el.querySelector('.spacing-ring') as SVGCircleElement | null;
        if (ring) ring.setAttribute('r', String(ringR));
        const cx = parseFloat(ring?.getAttribute('cx') ?? '0');
        const cy = parseFloat(ring?.getAttribute('cy') ?? '0');
        const flowerG = m.el.querySelector('.flower-icon') as SVGGElement | null;
        if (flowerG) {
          const s = dotR / FLOWER_RADIUS;
          flowerG.setAttribute(
            'transform',
            `translate(${cx},${cy}) scale(${s}) translate(-300,-300)`,
          );
        }
        const treeG = m.el.querySelector('.tree-icon') as SVGGElement | null;
        if (treeG) {
          const s = dotR / TREE_RADIUS;
          treeG.setAttribute(
            'transform',
            `translate(${cx},${cy}) scale(${s}) translate(-355.5,-140.3)`,
          );
        }
        const selCircle = m.el.querySelector('.sel-circle') as SVGCircleElement | null;
        if (selCircle) selCircle.setAttribute('r', String(dotR * 1.3));
      }
    }
    statusMsg.textContent = `Scale calibrated: 1 m = ${fmt(sessionScale, 1)} px`;
  }
  clearCalibration();
  setTool('select');
}

calibOkBtn.addEventListener('click', applyCalibration);
calibInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') applyCalibration();
});
calibCancelBtn.addEventListener('click', () => {
  clearCalibration();
  setTool('select');
});

// ── Background image import ────────────────────────────────────────────────
importBgBtn.addEventListener('click', () => bgFileInput.click());
bgFileInput.addEventListener('change', () => {
  const file = bgFileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    if (bgImageEl) bgLayer.removeChild(bgImageEl);
    bgImageEl = document.createElementNS(NS, 'image') as SVGImageElement;
    bgImageEl.setAttribute('href', ev.target!.result as string);
    bgX = 0;
    bgY = 0;
    bgImageEl.setAttribute('x', '0');
    bgImageEl.setAttribute('y', '0');
    bgImageEl.setAttribute('width', String(CANVAS_W));
    bgImageEl.setAttribute('height', String(CANVAS_H));
    bgImageEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    bgLayer.appendChild(bgImageEl);
    statusMsg.textContent = 'Image imported. Use Calibrate to set scale.';
  };
  reader.readAsDataURL(file);
  bgFileInput.value = '';
});

// ── Tool switching ─────────────────────────────────────────────────────────
function setTool(name: Tool): void {
  if (name !== 'calibrate') clearCalibration();
  if (name !== 'polygon') clearPolygon();
  currentTool = name;
  document.querySelectorAll('.tool-btn').forEach((b) => {
    (b as HTMLElement).classList.toggle('active', (b as HTMLElement).dataset['tool'] === name);
  });
  svgEl.className.baseVal = name === 'select' ? 'tool-select' : 'tool-draw';
  statusMsg.textContent = '';
}

document.querySelectorAll('.tool-btn').forEach((b) => {
  if (!(b as HTMLElement).dataset['tool']) return;
  b.addEventListener('click', () => setTool((b as HTMLElement).dataset['tool'] as Tool));
});

// ── Copy / Paste ────────────────────────────────────────────────────────────
const PASTE_OFFSET = 20;
let markerClipboard: { plant: Plant; x: number; y: number } | null = null;
let markerClipboardShape: ShapeData | null = null;

function copySelected(): void {
  if (!selectedMarker || !selectedMarkerShape) return;
  markerClipboard = { plant: selectedMarker.plant, x: selectedMarker.x, y: selectedMarker.y };
  markerClipboardShape = selectedMarkerShape;
}

function pasteMarker(): void {
  if (!markerClipboard || !markerClipboardShape || !selectedMarker) return;
  const x = markerClipboard.x + PASTE_OFFSET;
  const y = markerClipboard.y + PASTE_OFFSET;
  markerClipboard = { ...markerClipboard, x, y };
  const markerEl = createMarkerEl(markerClipboard.plant, x, y);
  const marker: PlantMarker = { plant: markerClipboard.plant, x, y, el: markerEl };
  markerClipboardShape.plantMarkers.push(marker);
  updateSummary();
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
document.addEventListener('keydown', (e: KeyboardEvent) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  if (e.key === ' ') {
    spaceDown = true;
    svgEl.style.cursor = 'grab';
    e.preventDefault();
    return;
  }
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'c') {
      copySelected();
      e.preventDefault();
    }
    if (e.key === 'v') {
      pasteMarker();
      e.preventDefault();
    }
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    deleteSelected();
    return;
  }
  if (e.key === 'r' || e.key === 'R') setTool('rect');
  if (e.key === 'c' || e.key === 'C') setTool('circle');
  if (e.key === 'e' || e.key === 'E') setTool('ellipse');
  if (e.key === 'p' || e.key === 'P') setTool('polygon');
  if (e.key === 'Escape' && currentTool !== 'select') {
    setTool('select');
    (document.activeElement as HTMLElement)?.blur();
  }
});

document.addEventListener('keyup', (e: KeyboardEvent) => {
  if (e.key === ' ') {
    spaceDown = false;
    if (!panning) svgEl.style.cursor = '';
  }
});

// ── Plant palette (left panel) ─────────────────────────────────────────────

// Normalize any hex color to 6-digit form for <input type="color">
function toColorInputHex(color: string): string {
  const c = color.replace('#', '');
  if (c.length === 3)
    return (
      '#' +
      c
        .split('')
        .map((x) => x + x)
        .join('')
    );
  return '#' + c.slice(0, 6);
}

// Edit popover state
const editPopover = document.getElementById('plant-edit-popover') as HTMLDivElement;
const editSpacingEl = document.getElementById('edit-spacing') as HTMLInputElement;
const editColorEl = document.getElementById('edit-color') as HTMLInputElement;
const editSaveBtn = document.getElementById('edit-save-btn') as HTMLButtonElement;
const editCancelBtn = document.getElementById('edit-cancel-btn') as HTMLButtonElement;
let editTarget: { chip: HTMLDivElement; plant: Plant } | null = null;

function closeEditPopover(): void {
  editPopover.style.display = 'none';
  editTarget = null;
}

function openEditPopover(plant: Plant, chip: HTMLDivElement): void {
  const override = plant.slug ? getOverride(plant.slug) : null;
  editSpacingEl.value = String(override?.spacing ?? plant.spacing);
  editColorEl.value = toColorInputHex(override?.color ?? plant.color);
  editTarget = { chip, plant };

  const rect = chip.getBoundingClientRect();
  editPopover.style.display = 'flex';
  const popW = editPopover.offsetWidth;
  const left = Math.min(rect.right + 6, window.innerWidth - popW - 8);
  editPopover.style.left = left + 'px';
  editPopover.style.top = rect.top + 'px';
}

// Update all placed markers for a slug to reflect new spacing/color.
function applyOverrideToMarkers(slug: string, spacing: number, color: string): void {
  for (const d of shapes) {
    for (const m of d.plantMarkers) {
      if (m.plant.slug !== slug) continue;
      m.plant.spacing = spacing;
      m.plant.color = color;
      applyOverrideToEl(m.el, spacing, color, sessionScale);
    }
  }
  renderUsedPlants();
}

editSaveBtn.addEventListener('click', () => {
  if (!editTarget) return;
  const { chip, plant } = editTarget;
  if (!plant.slug) return;

  const spacing = parseFloat(editSpacingEl.value);
  const color = editColorEl.value;
  const result = setOverride(plant.slug, { spacing, color });
  if (!result.ok) {
    alert(result.error);
    return;
  }

  // Update chip icon color and stored data
  chip
    .querySelectorAll('.chip-petal')
    .forEach((p) => (p as SVGElement).setAttribute('fill', color));
  chip.dataset.plantJson = JSON.stringify({ ...plant, spacing, color });

  // Update any markers already on the canvas
  applyOverrideToMarkers(plant.slug, spacing, color);
  closeEditPopover();
});

editCancelBtn.addEventListener('click', closeEditPopover);
document.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Escape') closeEditPopover();
  },
  true,
);
document.addEventListener('click', (e) => {
  if (editTarget && !editPopover.contains(e.target as Node)) closeEditPopover();
});

// ── Plant image tooltip ─────────────────────────────────────────────────────
// ── Plant image tooltip ─────────────────────────────────────────────────────
const imgTooltip = document.getElementById('plant-img-tooltip') as HTMLDivElement;
const imgTipImg = document.getElementById('plant-tip-img') as HTMLImageElement;
const imgTipSci = document.getElementById('plant-tip-sci') as HTMLDivElement;
const imgTipName = document.getElementById('plant-tip-name') as HTMLDivElement;
const imgTipMeta = document.getElementById('plant-tip-meta') as HTMLDivElement;
let imgTooltipTimer: ReturnType<typeof setTimeout> | null = null;

function showImgTooltip(plant: Plant, chipEl: Element): void {
  if (imgTooltipTimer) clearTimeout(imgTooltipTimer);
  imgTooltipTimer = setTimeout(() => {
    applyTooltipContent(plant, {
      img: imgTipImg,
      sciEl: imgTipSci,
      nameEl: imgTipName,
      metaEl: imgTipMeta,
    });

    imgTooltip.style.display = 'block';
    const rect = chipEl.getBoundingClientRect();
    const tipW = 216;
    const left = rect.right + 8 + tipW > window.innerWidth ? rect.left - tipW - 8 : rect.right + 8;
    imgTooltip.style.left = left + 'px';
    imgTooltip.style.top = Math.min(rect.top, window.innerHeight - 220) + 'px';
  }, 300);
}

function hideImgTooltip(): void {
  if (imgTooltipTimer) {
    clearTimeout(imgTooltipTimer);
    imgTooltipTimer = null;
  }
  imgTooltip.style.display = 'none';
  clearTooltipHandlers(imgTipImg);
}

function makeChip(plant: Plant): HTMLDivElement {
  const override = plant.slug ? getOverride(plant.slug) : null;
  const effective = {
    ...plant,
    spacing: override?.spacing ?? plant.spacing,
    color: override?.color ?? plant.color,
  };

  const chip = buildChipEl(plant, effective);

  if (plant.slug) {
    const editBtn = document.createElement('button');
    editBtn.className = 'chip-edit-btn';
    editBtn.draggable = false;
    editBtn.title = 'Edit spacing / colour';
    editBtn.textContent = '✎';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditPopover(plant, chip);
    });
    chip.appendChild(editBtn);
  }

  chip.addEventListener('dragstart', (e: DragEvent) => {
    e.dataTransfer!.setData('plantData', chip.dataset.plantJson!);
    e.dataTransfer!.effectAllowed = 'copy';
    chip.classList.add('dragging');
  });
  chip.addEventListener('dragend', () => chip.classList.remove('dragging'));

  if (plant.image_url || plant.scientific_name) {
    chip.addEventListener('mouseenter', () => showImgTooltip(plant, chip));
    chip.addEventListener('mouseleave', hideImgTooltip);
    chip.addEventListener('dragstart', hideImgTooltip);
  }

  return chip;
}

function renderSearchResults(plants: Plant[]): void {
  const el = document.getElementById('search-results') as HTMLDivElement;
  el.innerHTML = '';
  plants.forEach((plant) => el.appendChild(makeChip(plant)));
}

// ── Custom plant chips ──────────────────────────────────────────────────────

function makeCustomChip(plant: Plant, index: number): HTMLDivElement {
  const chip = buildChipEl(plant, plant);

  // Edit button — opens the add/edit form in edit mode
  const editBtn = document.createElement('button');
  editBtn.className = 'chip-edit-btn';
  editBtn.draggable = false;
  editBtn.title = 'Edit plant';
  editBtn.textContent = '✎';
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openCustomPlantForm(plant);
  });
  chip.appendChild(editBtn);

  // Delete button — uses index captured at render time (safe: delete is immediate, no deferred lookup)
  const delBtn = document.createElement('button');
  delBtn.className = 'chip-edit-btn chip-delete-btn';
  delBtn.draggable = false;
  delBtn.title = 'Remove plant';
  delBtn.textContent = '✕';
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (
      window.confirm(`Delete ${plant.name}? All markers placed on the canvas will also be removed.`)
    ) {
      // Remove every placed marker that belongs to this custom plant.
      for (const shape of shapes) {
        const remaining: PlantMarker[] = [];
        for (const m of shape.plantMarkers) {
          if (plant.id !== undefined && m.plant.id === plant.id) {
            // Deselect if this marker was the active selection.
            if (m === selectedMarker) deselectMarker();
            m.el.remove();
          } else {
            remaining.push(m);
          }
        }
        shape.plantMarkers = remaining;
      }
      updateSummary();
      removeCustomPlant(index);
    }
  });
  chip.appendChild(delBtn);

  chip.addEventListener('dragstart', (e: DragEvent) => {
    e.dataTransfer!.setData('plantData', chip.dataset.plantJson!);
    e.dataTransfer!.effectAllowed = 'copy';
    chip.classList.add('dragging');
  });
  chip.addEventListener('dragend', () => chip.classList.remove('dragging'));

  return chip;
}

function renderCustomPlants(): void {
  const listEl = document.getElementById('custom-plants-list') as HTMLDivElement;
  const plants = getCustomPlants();
  listEl.innerHTML = '';
  plants.forEach((plant, idx) => listEl.appendChild(makeCustomChip(plant, idx)));
}

// Subscribe so list re-renders on any change (add/edit/delete/restore)
subscribeCustomPlants(renderCustomPlants);

// ── Custom plant add/edit form ──────────────────────────────────────────────

const customPlantDialog = document.getElementById('custom-plant-dialog') as HTMLDivElement;
const cpNameEl = document.getElementById('cp-name') as HTMLInputElement;
const cpSpacingEl = document.getElementById('cp-spacing') as HTMLInputElement;
const cpColorEl = document.getElementById('cp-color') as HTMLInputElement;
const cpGrowthEl = document.getElementById('cp-growth') as HTMLSelectElement;
const cpHeightEl = document.getElementById('cp-height') as HTMLInputElement;
const cpSaveBtn = document.getElementById('cp-save-btn') as HTMLButtonElement;
const cpCancelBtn = document.getElementById('cp-cancel-btn') as HTMLButtonElement;
const cpDialogTitle = document.getElementById('cp-dialog-title') as HTMLHeadingElement;

// Id of the custom plant being edited, or null when adding new
let customPlantEditId: string | null = null;

function openCustomPlantForm(plant?: Plant): void {
  customPlantEditId = plant?.id ?? null;
  cpDialogTitle.textContent = plant !== undefined ? 'Edit plant' : 'Add plant';
  cpNameEl.value = plant?.name ?? '';
  cpSpacingEl.value = String(plant?.spacing ?? 0.3);
  cpColorEl.value = toColorInputHex(plant?.color ?? '#90a4ae');
  cpGrowthEl.value = plant?.growth_habit ?? 'flower';
  cpHeightEl.value = plant?.height_cm !== undefined ? String(plant.height_cm) : '';
  customPlantDialog.style.display = 'flex';
  cpNameEl.focus();
}

function closeCustomPlantForm(): void {
  customPlantDialog.style.display = 'none';
  customPlantEditId = null;
}

cpSaveBtn.addEventListener('click', () => {
  const validationError = validateCustomPlantInput(
    { name: cpNameEl.value, spacingRaw: cpSpacingEl.value },
    customPlantEditId ?? undefined,
    isNameAvailable,
    isKnownPlantName,
  );
  if (validationError) {
    alert(validationError);
    return;
  }

  const name = cpNameEl.value.trim();
  const spacing = parseFloat(cpSpacingEl.value);

  const color = cpColorEl.value;
  const growth_habit = cpGrowthEl.value;
  const icon: 'flower' | 'tree' = /tree|shrub/i.test(growth_habit) ? 'tree' : 'flower';
  const heightRaw = cpHeightEl.value.trim();
  const height_cm = heightRaw !== '' ? parseFloat(heightRaw) : undefined;

  const plantData: Plant = {
    name,
    spacing,
    color,
    growth_habit,
    icon,
    ...(height_cm !== undefined && !isNaN(height_cm) && { height_cm }),
    isCustom: true,
  };

  if (customPlantEditId !== null) {
    const idx = getAllCustomPlants().findIndex((p) => p.id === customPlantEditId);
    if (idx >= 0) {
      // Preserve the stable id when updating
      updateCustomPlant(idx, { ...plantData, id: customPlantEditId });
    }
  } else {
    addCustomPlant(plantData);
  }
  closeCustomPlantForm();
});

cpCancelBtn.addEventListener('click', closeCustomPlantForm);

document.getElementById('add-custom-plant-btn')!.addEventListener('click', () => {
  openCustomPlantForm();
});

// Close dialog on Escape (added with capture so it runs before the existing edit-popover handler)
document.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Escape') closeCustomPlantForm();
  },
  true,
);

// ── Zoom / pan helpers ──────────────────────────────────────────────────────
function drawRulers(): void {
  const svgW = svgEl.clientWidth;
  const svgH = svgEl.clientHeight;
  if (!svgW || !svgH) return;

  const RULER_SIZE = 20;
  const BG = '#f0f0f0';
  const TICK = '#999';
  const TEXT_COLOR = '#555';

  function drawAxis(
    canvas: HTMLCanvasElement,
    length: number,
    isHorizontal: boolean,
    vbStart: number,
    vbSpan: number,
  ): void {
    canvas.width = isHorizontal ? length : RULER_SIZE;
    canvas.height = isHorizontal ? RULER_SIZE : length;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = '9px system-ui,sans-serif';
    ctx.fillStyle = TEXT_COLOR;
    ctx.strokeStyle = TICK;

    for (const tick of rulerTicks(vbStart, vbSpan, length, sessionScale)) {
      const tickLen = tick.major ? 10 : 5;
      ctx.lineWidth = tick.major ? 1 : 0.5;
      ctx.beginPath();
      if (isHorizontal) {
        ctx.moveTo(tick.pos, RULER_SIZE - tickLen);
        ctx.lineTo(tick.pos, RULER_SIZE);
      } else {
        ctx.moveTo(RULER_SIZE - tickLen, tick.pos);
        ctx.lineTo(RULER_SIZE, tick.pos);
      }
      ctx.stroke();

      if (tick.showLabel) {
        const label = tick.m + 'm';
        if (isHorizontal) {
          ctx.textAlign = 'center';
          ctx.fillText(label, tick.pos, RULER_SIZE - tickLen - 2);
        } else {
          ctx.save();
          ctx.translate(RULER_SIZE - tickLen - 2, tick.pos);
          ctx.rotate(-Math.PI / 2);
          ctx.textAlign = 'center';
          ctx.fillText(label, 0, 0);
          ctx.restore();
        }
      }
    }
  }

  drawAxis(hRuler, svgW, true, vbX, vbW);
  drawAxis(vRuler, svgH, false, vbY, vbH);
}

function applyViewBox(): void {
  svgEl.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
  drawRulers();
}

const ZOOM_FACTOR = 1.15;

svgEl.addEventListener(
  'wheel',
  (e: WheelEvent) => {
    e.preventDefault();
    const { minVbW, maxVbW } = calcZoomLimits(sessionScale);
    const pt = svgCoords(e);
    const factor = e.deltaY > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    const newW = Math.min(maxVbW, Math.max(minVbW, vbW * factor));
    const newH = newW * (svgEl.clientHeight / svgEl.clientWidth);
    const rect = svgEl.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    vbX = Math.max(0, pt.x - relX * newW);
    vbY = Math.max(0, pt.y - relY * newH);
    vbW = newW;
    vbH = newH;
    applyViewBox();
  },
  { passive: false },
);

// ── Drag-and-drop onto SVG ─────────────────────────────────────────────────
function svgCoords(e: MouseEvent): { x: number; y: number } {
  const pt = svgEl.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const s = pt.matrixTransform(svgEl.getScreenCTM()!.inverse());
  return { x: s.x, y: s.y };
}

// Fill a shape with a grid of plant markers, skipping positions already occupied.
function fillShapeWithPlant(shape: ShapeData, plant: Plant): void {
  const areaM2 = calcArea(shape, sessionScale);
  const estimated = calcFillCount(areaM2, shape.plantMarkers.length, plant.spacing);

  if (estimated <= 0) {
    statusMsg.textContent = `No space left to fill with "${plant.name}".`;
    return;
  }

  const existingPositions = shape.plantMarkers.map((m) => ({ x: m.x, y: m.y }));
  const positions = computeFillPositions(shape, plant.spacing, sessionScale, existingPositions);
  let placed = 0;

  for (const { x: gx, y: gy } of positions) {
    const filledMarkerEl = createMarkerEl(plant, gx, gy);
    shape.plantMarkers.push({ plant, x: gx, y: gy, el: filledMarkerEl });
    placed++;
  }

  if (placed === 0) {
    statusMsg.textContent = `No space left to fill with "${plant.name}".`;
    return;
  }

  updateSummary();
  statusMsg.textContent = `Filled with ${placed} × ${plant.name}`;
}

svgEl.addEventListener('dragover', (e: DragEvent) => {
  if (!e.dataTransfer!.types.includes('plantdata')) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'copy';
});

svgEl.addEventListener('drop', (e: DragEvent) => {
  e.preventDefault();
  const raw = e.dataTransfer!.getData('plantData');
  if (!raw) return;
  const plant: Plant = JSON.parse(raw);

  const { x, y } = svgCoords(e);

  let targetShape: ShapeData | null = null;
  for (let i = shapes.length - 1; i >= 0; i--) {
    if (pointInShape(shapes[i], x, y)) {
      targetShape = shapes[i];
      break;
    }
  }
  if (!targetShape) return;

  if (fillMode) {
    fillMode = false;
    fillModeCheck.checked = false;
    fillShapeWithPlant(targetShape, plant);
    return;
  }

  const markerEl = createMarkerEl(plant, x, y);
  const marker: PlantMarker = { plant, x, y, el: markerEl };
  targetShape.plantMarkers.push(marker);
  selectMarker(marker, targetShape);

  updateSummary();
});

// ── Drawing ────────────────────────────────────────────────────────────────
function nextColor(): { fill: string; stroke: string } {
  const i = colorIndex % FILL_COLORS.length;
  colorIndex++;
  return { fill: FILL_COLORS[i], stroke: STROKE_COLORS[i] };
}

svgEl.addEventListener('mousedown', (e: MouseEvent) => {
  // ── Middle-click or space+left-click → pan ─────────────────────────────
  if (e.button === 1 || (e.button === 0 && spaceDown)) {
    e.preventDefault();
    panning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panVbStartX = vbX;
    panVbStartY = vbY;
    svgEl.style.cursor = 'grabbing';
    return;
  }

  // ── Select mode: markers and shape drag ────────────────────────────────
  if (currentTool === 'select') {
    const markerGroup = (e.target as Element).closest('[data-marker]') as SVGGElement | null;
    if (markerGroup) {
      for (const d of shapes) {
        const m = d.plantMarkers.find((pm) => pm.el === markerGroup);
        if (m) {
          selectMarker(m, d);
          const pt = svgCoords(e);
          dragMouseStartX = pt.x;
          dragMouseStartY = pt.y;
          draggingMarker = m;
          dragMarkerOrigX = m.x;
          dragMarkerOrigY = m.y;
          e.preventDefault();
          return;
        }
      }
      return;
    }
  } else {
    // Non-select modes: ignore clicks on markers
    if ((e.target as Element).closest('[data-marker]')) return;
  }

  // Calibrate mode: collect two click points
  if (currentTool === 'calibrate') {
    if (calibPts.length >= 2) return; // wait for overlay
    const pt = svgCoords(e);
    const dot = document.createElementNS(NS, 'circle') as SVGCircleElement;
    dot.setAttribute('cx', String(pt.x));
    dot.setAttribute('cy', String(pt.y));
    dot.setAttribute('r', '5');
    dot.setAttribute('fill', '#f44336');
    dot.setAttribute('stroke', '#fff');
    dot.setAttribute('stroke-width', '1.5');
    dot.style.pointerEvents = 'none';
    overlayLayer.appendChild(dot);
    calibMarkers.push(dot);
    calibPts.push(pt);

    if (calibPts.length === 1) {
      statusMsg.textContent = 'Click second point…';
    } else {
      calibLineEl = document.createElementNS(NS, 'line') as SVGLineElement;
      calibLineEl.setAttribute('x1', String(calibPts[0].x));
      calibLineEl.setAttribute('y1', String(calibPts[0].y));
      calibLineEl.setAttribute('x2', String(pt.x));
      calibLineEl.setAttribute('y2', String(pt.y));
      calibLineEl.setAttribute('stroke', '#f44336');
      calibLineEl.setAttribute('stroke-dasharray', '6,4');
      calibLineEl.setAttribute('stroke-width', '2');
      calibLineEl.style.pointerEvents = 'none';
      overlayLayer.appendChild(calibLineEl);
      const midPt = svgEl.createSVGPoint();
      midPt.x = (calibPts[0].x + pt.x) / 2;
      midPt.y = (calibPts[0].y + pt.y) / 2;
      const midScreen = midPt.matrixTransform(svgEl.getScreenCTM()!);
      calibOverlay.style.left = midScreen.x + 'px';
      calibOverlay.style.top = midScreen.y - 20 + 'px';
      calibOverlay.style.display = 'block';
      calibInput.value = '';
      calibInput.focus();
      statusMsg.textContent = 'Enter real-world distance and press OK.';
    }
    return;
  }

  // Polygon mode: click to place vertices; click first vertex to close
  if (currentTool === 'polygon') {
    const pt = svgCoords(e);
    if (polyPts.length === 0) {
      polyPts.push(pt);
      addVertexDot(pt, true);
      statusMsg.textContent = 'Click to add points. Click first point to close (≥ 3 points).';
    } else {
      const first = polyPts[0];
      const dist = Math.hypot(pt.x - first.x, pt.y - first.y);
      if (dist <= SNAP_RADIUS && polyPts.length >= 3) {
        finalizePolygon();
      } else {
        polyPts.push(pt);
        addVertexDot(pt, false);
        drawPolySegment(polyPts[polyPts.length - 2], pt);
        statusMsg.textContent = `${polyPts.length} points placed. Click first point to close.`;
      }
    }
    return;
  }

  // Select mode: move bg image / select+drag shape / deselect
  if (currentTool === 'select') {
    if (e.target === bgImageEl) {
      movingBg = true;
      const pt = svgCoords(e);
      moveBgStartX = pt.x;
      moveBgStartY = pt.y;
      moveBgOrigX = bgX;
      moveBgOrigY = bgY;
      return;
    }
    const hit = (e.target as Element).closest('[data-shape]');
    const d = hit ? findShapeByEl(hit) : null;
    selectShape(d);
    if (d) {
      const pt = svgCoords(e);
      dragMouseStartX = pt.x;
      dragMouseStartY = pt.y;
      draggingShape = d;
      if (d.type === 'rect') {
        dragShapeOrigRectX = d.x;
        dragShapeOrigRectY = d.y;
      } else if (d.type === 'circle' || d.type === 'ellipse') {
        dragShapeOrigCx = d.cx;
        dragShapeOrigCy = d.cy;
      } else if (d.type === 'polygon') {
        dragShapeOrigPoints = d.points.map((p) => ({ ...p }));
      }
      dragShapeMarkersOrig = d.plantMarkers.map((m) => ({ x: m.x, y: m.y }));
    }
    return;
  }

  const p = svgCoords(e);
  startX = p.x;
  startY = p.y;
  drawing = true;

  const { fill, stroke } = nextColor();

  if (currentTool === 'rect') {
    activeEl = document.createElementNS(NS, 'rect') as SVGRectElement;
    activeEl.setAttribute('x', String(startX));
    activeEl.setAttribute('y', String(startY));
    activeEl.setAttribute('width', '0');
    activeEl.setAttribute('height', '0');
  } else if (currentTool === 'circle') {
    activeEl = document.createElementNS(NS, 'circle') as SVGCircleElement;
    activeEl.setAttribute('cx', String(startX));
    activeEl.setAttribute('cy', String(startY));
    activeEl.setAttribute('r', '0');
  } else if (currentTool === 'ellipse') {
    activeEl = document.createElementNS(NS, 'ellipse') as SVGEllipseElement;
    activeEl.setAttribute('cx', String(startX));
    activeEl.setAttribute('cy', String(startY));
    activeEl.setAttribute('rx', '0');
    activeEl.setAttribute('ry', '0');
  }

  if (!activeEl) return;
  activeEl.setAttribute('fill', fill);
  activeEl.setAttribute('stroke', stroke);
  activeEl.setAttribute('stroke-width', DEF_SW);
  (activeEl as SVGElement & { dataset: DOMStringMap }).dataset['shape'] = '1';
  activeEl.style.cursor = 'pointer';
  (activeEl as SVGElement & Record<string, string>)['_fill'] = fill;
  (activeEl as SVGElement & Record<string, string>)['_stroke'] = stroke;

  shapesLayer.appendChild(activeEl);
  e.preventDefault();
});

svgEl.addEventListener('mousemove', (e: MouseEvent) => {
  if (panning) {
    const rect = svgEl.getBoundingClientRect();
    vbX = Math.max(0, panVbStartX - ((e.clientX - panStartX) / rect.width) * vbW);
    vbY = Math.max(0, panVbStartY - ((e.clientY - panStartY) / rect.height) * vbH);
    applyViewBox();
    return;
  }
  if (currentTool === 'polygon' && polyPts.length > 0) {
    const pt = svgCoords(e);
    updatePolyPreview(pt);
    // Snap indicator: enlarge first vertex dot when cursor can close the polygon
    const first = polyPts[0];
    const dist = Math.hypot(pt.x - first.x, pt.y - first.y);
    const canClose = polyPts.length >= 3;
    polyVertexDots[0].setAttribute('r', dist <= SNAP_RADIUS && canClose ? '8' : '5');
    polyVertexDots[0].setAttribute('stroke-width', dist <= SNAP_RADIUS && canClose ? '2.5' : '1.5');
    // Show live segment length
    const last = polyPts[polyPts.length - 1];
    const segLen = Math.hypot(pt.x - last.x, pt.y - last.y);
    if (segLen > 1) updateDimLabel(pt.x, pt.y - 16, fmt(pxToM(segLen, sessionScale)) + ' m');
    return;
  }
  if (draggingShape) {
    const pt = svgCoords(e);
    moveShapeTo(draggingShape, pt.x - dragMouseStartX, pt.y - dragMouseStartY);
    return;
  }
  if (draggingMarker) {
    const pt = svgCoords(e);
    moveMarkerEl(
      draggingMarker,
      dragMarkerOrigX + (pt.x - dragMouseStartX),
      dragMarkerOrigY + (pt.y - dragMouseStartY),
    );
    return;
  }
  if (movingBg && bgImageEl) {
    const pt = svgCoords(e);
    bgX = moveBgOrigX + (pt.x - moveBgStartX);
    bgY = moveBgOrigY + (pt.y - moveBgStartY);
    bgImageEl.setAttribute('x', String(bgX));
    bgImageEl.setAttribute('y', String(bgY));
    return;
  }
  if (!drawing || !activeEl) return;
  const p = svgCoords(e);

  if (currentTool === 'rect') {
    const x = Math.min(startX, p.x),
      y = Math.min(startY, p.y);
    const w = Math.abs(p.x - startX),
      h = Math.abs(p.y - startY);
    activeEl.setAttribute('x', String(x));
    activeEl.setAttribute('y', String(y));
    activeEl.setAttribute('width', String(w));
    activeEl.setAttribute('height', String(h));
    updateDimLabel(
      x + w / 2,
      y - 12,
      `${fmt(pxToM(w, sessionScale))} × ${fmt(pxToM(h, sessionScale))} m`,
    );
  } else if (currentTool === 'circle') {
    const dx = p.x - startX,
      dy = p.y - startY;
    const r = Math.sqrt(dx * dx + dy * dy);
    activeEl.setAttribute('r', String(r));
    updateDimLabel(startX, startY - r - 14, `r = ${fmt(pxToM(r, sessionScale))} m`);
  } else if (currentTool === 'ellipse') {
    const rx = Math.abs(p.x - startX) / 2,
      ry = Math.abs(p.y - startY) / 2;
    const cx = (startX + p.x) / 2,
      cy = (startY + p.y) / 2;
    activeEl.setAttribute('cx', String(cx));
    activeEl.setAttribute('cy', String(cy));
    activeEl.setAttribute('rx', String(rx));
    activeEl.setAttribute('ry', String(ry));
    updateDimLabel(
      cx,
      cy - ry - 14,
      `${fmt(pxToM(rx * 2, sessionScale))} × ${fmt(pxToM(ry * 2, sessionScale))} m`,
    );
  }
});

document.addEventListener('mouseup', () => {
  if (panning) {
    panning = false;
    svgEl.style.cursor = spaceDown ? 'grab' : '';
    return;
  }
  draggingShape = null;
  draggingMarker = null;
  if (movingBg) {
    movingBg = false;
    return;
  }
  if (!drawing || !activeEl) return;
  drawing = false;
  hideDimLabel();

  let d: ShapeData | null = null;
  const el = activeEl;
  const fill = (el as SVGElement & Record<string, string>)['_fill'];
  const stroke = (el as SVGElement & Record<string, string>)['_stroke'];

  if (currentTool === 'rect') {
    const w = parseFloat(el.getAttribute('width') ?? '0') || 0;
    const h = parseFloat(el.getAttribute('height') ?? '0') || 0;
    if (w < 4 || h < 4) {
      el.remove();
      activeEl = null;
      return;
    }
    d = {
      type: 'rect',
      el: el as SVGGeometryElement,
      plantMarkers: [],
      x: parseFloat(el.getAttribute('x') ?? '0'),
      y: parseFloat(el.getAttribute('y') ?? '0'),
      w,
      h,
      fill,
      stroke,
    };
  } else if (currentTool === 'circle') {
    const r = parseFloat(el.getAttribute('r') ?? '0') || 0;
    if (r < 4) {
      el.remove();
      activeEl = null;
      return;
    }
    d = {
      type: 'circle',
      el: el as SVGGeometryElement,
      plantMarkers: [],
      cx: parseFloat(el.getAttribute('cx') ?? '0'),
      cy: parseFloat(el.getAttribute('cy') ?? '0'),
      r,
      fill,
      stroke,
    };
  } else if (currentTool === 'ellipse') {
    const rx = parseFloat(el.getAttribute('rx') ?? '0') || 0;
    const ry = parseFloat(el.getAttribute('ry') ?? '0') || 0;
    if (rx < 4 || ry < 4) {
      el.remove();
      activeEl = null;
      return;
    }
    d = {
      type: 'ellipse',
      el: el as SVGGeometryElement,
      plantMarkers: [],
      cx: parseFloat(el.getAttribute('cx') ?? '0'),
      cy: parseFloat(el.getAttribute('cy') ?? '0'),
      rx,
      ry,
      fill,
      stroke,
    };
  }

  if (!d) {
    activeEl = null;
    return;
  }

  shapes.push(d);
  activeEl = null;

  setTool('select');
  selectShape(d);
});

// ── Save / Load ─────────────────────────────────────────────────────────────

function saveDesign(): void {
  const bgImageData = bgImageEl
    ? { dataUrl: bgImageEl.getAttribute('href') ?? '', x: bgX, y: bgY }
    : null;
  const data = buildSaveData(
    shapes,
    getAllOverrides(),
    sessionScale,
    bgImageData,
    getAllCustomPlants(),
  );
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const projectName = (document.getElementById('project-name') as HTMLInputElement).value.trim();
  const filename = projectName ? `${projectName}.json` : 'flowerbed.json';
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function clearCanvas(): void {
  setTool('select'); // resets polygon / calibration state and overlayLayer elements
  shapesLayer.innerHTML = '';
  flowersLayer.innerHTML = '';
  treesLayer.innerHTML = '';
  if (bgImageEl) {
    bgLayer.removeChild(bgImageEl);
    bgImageEl = null;
  }
  bgX = 0;
  bgY = 0;
  shapes = [];
  selectedData = null;
  selectedMarker = null;
  selectedMarkerShape = null;
  draggingShape = null;
  draggingMarker = null;
  fillMode = false;
  fillModeCheck.checked = false;

  sessionScale = SCALE;
  scaleInfo.textContent = '';
  drawGrid();
  colorIndex = 0;
  vbX = 0;
  vbY = 0;
  vbW = CANVAS_W;
  vbH = svgEl.clientHeight ? vbW * (svgEl.clientHeight / svgEl.clientWidth) : CANVAS_H;
  applyViewBox();
  // Clear custom plants (will be restored from save data when loading)
  restoreCustomPlants([]);
}

function restoreShapeFromSave(saved: SavedShape): ShapeData {
  const { fill, stroke } = saved;
  let el: SVGGeometryElement;
  let d: ShapeData;

  if (saved.type === 'rect') {
    const r = document.createElementNS(NS, 'rect') as SVGRectElement;
    r.setAttribute('x', String(saved.x));
    r.setAttribute('y', String(saved.y));
    r.setAttribute('width', String(saved.w));
    r.setAttribute('height', String(saved.h));
    el = r as unknown as SVGGeometryElement;
    d = {
      type: 'rect',
      el,
      plantMarkers: [],
      x: saved.x,
      y: saved.y,
      w: saved.w,
      h: saved.h,
      fill,
      stroke,
    };
  } else if (saved.type === 'circle') {
    const c = document.createElementNS(NS, 'circle') as SVGCircleElement;
    c.setAttribute('cx', String(saved.cx));
    c.setAttribute('cy', String(saved.cy));
    c.setAttribute('r', String(saved.r));
    el = c as unknown as SVGGeometryElement;
    d = {
      type: 'circle',
      el,
      plantMarkers: [],
      cx: saved.cx,
      cy: saved.cy,
      r: saved.r,
      fill,
      stroke,
    };
  } else if (saved.type === 'ellipse') {
    const e = document.createElementNS(NS, 'ellipse') as SVGEllipseElement;
    e.setAttribute('cx', String(saved.cx));
    e.setAttribute('cy', String(saved.cy));
    e.setAttribute('rx', String(saved.rx));
    e.setAttribute('ry', String(saved.ry));
    el = e as unknown as SVGGeometryElement;
    d = {
      type: 'ellipse',
      el,
      plantMarkers: [],
      cx: saved.cx,
      cy: saved.cy,
      rx: saved.rx,
      ry: saved.ry,
      fill,
      stroke,
    };
  } else {
    const p = document.createElementNS(NS, 'polygon') as SVGPolygonElement;
    p.setAttribute('points', saved.points.map((pt) => `${pt.x},${pt.y}`).join(' '));
    el = p as unknown as SVGGeometryElement;
    d = {
      type: 'polygon',
      el,
      plantMarkers: [],
      points: saved.points,
      fill,
      stroke,
    };
  }

  el.setAttribute('fill', fill);
  el.setAttribute('stroke', stroke);
  el.setAttribute('stroke-width', DEF_SW);
  (el as SVGElement & { dataset: DOMStringMap }).dataset['shape'] = '1';
  el.style.cursor = 'pointer';
  shapesLayer.appendChild(el);

  for (const m of saved.markers) {
    const markerEl = createMarkerEl(m.plant, m.x, m.y);
    d.plantMarkers.push({ plant: m.plant, x: m.x, y: m.y, el: markerEl });
  }
  return d;
}

function restoreDesign(data: SaveData): void {
  sessionScale = data.sessionScale;
  scaleInfo.textContent =
    sessionScale !== SCALE ? `Scale: 1 m = ${Math.round(sessionScale)} px` : '';
  drawGrid(sessionScale);

  restoreOverrides(data.overrides ?? {});
  restoreCustomPlants(data.customPlants ?? []);

  if (data.bgImage) {
    bgImageEl = document.createElementNS(NS, 'image') as SVGImageElement;
    bgImageEl.setAttribute('href', data.bgImage.dataUrl);
    bgX = data.bgImage.x;
    bgY = data.bgImage.y;
    bgImageEl.setAttribute('x', String(bgX));
    bgImageEl.setAttribute('y', String(bgY));
    bgImageEl.setAttribute('width', String(CANVAS_W));
    bgImageEl.setAttribute('height', String(CANVAS_H));
    bgImageEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    bgLayer.appendChild(bgImageEl);
  }

  for (const saved of data.shapes) {
    shapes.push(restoreShapeFromSave(saved));
  }

  updateSummary();
}

const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
saveBtn.addEventListener('click', saveDesign);

const loadBtn = document.getElementById('load-btn') as HTMLButtonElement;
const loadFileInput = document.getElementById('load-file-input') as HTMLInputElement;

loadBtn.addEventListener('click', () => loadFileInput.click());
loadFileInput.addEventListener('change', () => {
  const file = loadFileInput.files?.[0];
  if (!file) return;
  if (shapes.length > 0 || bgImageEl) {
    if (!confirm('Loading a file will replace the current design. Continue?')) {
      loadFileInput.value = '';
      return;
    }
  }
  const reader = new FileReader();
  const projectNameInput = document.getElementById('project-name') as HTMLInputElement;
  reader.onload = (ev) => {
    try {
      const data = parseSaveData(ev.target!.result as string);
      clearCanvas();
      restoreDesign(data);
      projectNameInput.value = file.name.replace(/\.json$/i, '');
      statusMsg.textContent = 'Design loaded.';
    } catch (e) {
      alert(`Failed to load: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };
  reader.readAsText(file);
  loadFileInput.value = '';
});

// ── XLS export ─────────────────────────────────────────────────────────────
function exportXlsx(): void {
  const rows = buildExportRows(shapes);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plant Summary');
  XLSX.writeFile(wb, 'plant-summary.xlsx');
}

document.getElementById('export-xls-btn')!.addEventListener('click', exportXlsx);

// ── Init ───────────────────────────────────────────────────────────────────
const plantSearchEl = document.getElementById('plant-search') as HTMLInputElement;
plantSearchEl.addEventListener('input', () => {
  renderSearchResults(searchPlants(plantSearchEl.value));
});

drawGrid();
drawRulers();
setTool('select');

// Recompute vbH whenever the canvas container resizes so the SVG fills the space
new ResizeObserver(() => {
  if (!svgEl.clientWidth || !svgEl.clientHeight) return;
  vbH = vbW * (svgEl.clientHeight / svgEl.clientWidth);
  applyViewBox();
}).observe(document.getElementById('canvas-container')!);

window.addEventListener('beforeunload', (e) => {
  if (shapes.length > 0) e.preventDefault();
});
