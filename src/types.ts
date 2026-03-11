export interface Plant {
  name: string;
  spacing: number; // metres, centre-to-centre
  color: string;   // CSS hex color
}

export interface PlantMarker {
  plant: Plant;
  x: number;
  y: number;
  el: SVGGElement;
}

export interface LabelEl {
  g: SVGGElement;
  bg: SVGRectElement;
  tx1: SVGTextElement;
  tx2: SVGTextElement;
}

interface ShapeBase {
  el: SVGGeometryElement;
  labelEl: LabelEl | null;
  fill: string;
  stroke: string;
  plantMarkers: PlantMarker[];
}

export interface RectShape extends ShapeBase {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CircleShape extends ShapeBase {
  type: 'circle';
  cx: number;
  cy: number;
  r: number;
}

export interface EllipseShape extends ShapeBase {
  type: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export type ShapeData = RectShape | CircleShape | EllipseShape;
